/**
 * Discovery 爬蟲抽象基類
 * 使用模板方法模式封裝共用流程，子類只需實作平台特定邏輯
 */

import { launchBrowser, createContext, createPage, randomDelay } from '../browser.js';
import { parseCliArgs } from '../output.js';
import type { Page, BrowserContext, Browser } from 'playwright';
import type {
  DiscoveredProduct,
  DiscoveryConfig,
  DiscoveryOptions,
  ContextOptions,
  CookieConfig,
  ScrollConfig,
  DiscoveryJsonlRecord,
} from './types.js';
import {
  parseDiscoveryArgs,
  validateArgs,
  deduplicateProducts,
  toJsonlRecords,
  writeJsonlOutput,
  printConsoleOutput,
} from './utils.js';

export abstract class BaseDiscovery {
  protected config: DiscoveryConfig;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * 主執行函數（模板方法模式）
   */
  async run(): Promise<void> {
    const rawArgs = parseCliArgs();
    const options = parseDiscoveryArgs(rawArgs);

    // 驗證參數
    const validationError = validateArgs(options, this.config);
    if (validationError) {
      console.error(validationError);
      process.exit(1);
    }

    console.log(`🔍 ${this.config.platform} 商品發現: source=${options.source}, category=${options.category}, limit=${options.limit}`);

    try {
      // 初始化瀏覽器
      await this.initBrowser(options);

      // 執行抓取
      const products = await this.scrapeAll(options);

      // 去重
      const uniqueProducts = deduplicateProducts(products);
      console.log(`\n📦 共發現 ${uniqueProducts.length} 個不重複商品`);

      // Headless 模式警告
      if (uniqueProducts.length === 0 && options.headless) {
        this.printHeadlessWarning();
      }

      // 輸出結果
      await this.outputResults(uniqueProducts, options);

    } finally {
      await this.cleanup();
    }
  }

  /**
   * 初始化瀏覽器（可被子類覆寫以添加特殊設定）
   */
  protected async initBrowser(options: DiscoveryOptions): Promise<void> {
    this.browser = await launchBrowser({
      headless: options.headless,
      timeout: 60000,
    });

    const contextOptions = this.getContextOptions(options);
    this.context = await createContext(this.browser, contextOptions);

    // 設定額外 cookies（如 Best Buy 需要）
    const extraCookies = this.getExtraCookies();
    if (extraCookies.length > 0) {
      await this.context.addCookies(extraCookies);
    }

    this.page = await createPage(this.context);
  }

  /**
   * 取得瀏覽器上下文配置（子類可覆寫）
   */
  protected getContextOptions(_options: DiscoveryOptions): ContextOptions {
    return {
      locale: 'en-US',
      timeout: 60000,
    };
  }

  /**
   * 取得額外 cookies（子類可覆寫）
   */
  protected getExtraCookies(): CookieConfig[] {
    return [];
  }

  /**
   * 輸出 headless 模式警告（子類可覆寫）
   */
  protected printHeadlessWarning(): void {
    // 預設不輸出警告，各平台可覆寫
  }

  /**
   * 抓取所有來源的商品
   */
  protected async scrapeAll(options: DiscoveryOptions): Promise<DiscoveredProduct[]> {
    const allProducts: DiscoveredProduct[] = [];

    const sourcesToScrape = options.source === 'all'
      ? this.config.validSources.filter(s => s !== 'all')
      : [options.source];

    for (const src of sourcesToScrape) {
      console.log(`\n📊 抓取 ${src}...`);
      const products = await this.scrapeSource(src, options);
      allProducts.push(...products);
      console.log(`   ✅ 找到 ${products.length} 個商品`);

      if (sourcesToScrape.length > 1) {
        await randomDelay(2000, 4000);
      }
    }

    return allProducts;
  }

  /**
   * 抓取單一來源（模板方法）
   */
  protected async scrapeSource(source: string, options: DiscoveryOptions): Promise<DiscoveredProduct[]> {
    if (!this.page) throw new Error('Page not initialized');

    const url = this.buildSourceUrl(source, options.category);
    console.log(`   📄 載入 ${url}`);

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // 等待商品列表載入
    await this.waitForProducts();

    // 捲動載入更多
    await this.scrollToLoadMore(options.limit);

    // 提取商品
    return this.extractProducts(source, options.category, options.limit);
  }

  /**
   * 構建來源 URL（子類必須實作）
   */
  protected abstract buildSourceUrl(source: string, category: string): string;

  /**
   * 等待商品列表載入（子類必須實作）
   */
  protected abstract waitForProducts(): Promise<void>;

  /**
   * 提取商品資訊（子類必須實作）
   */
  protected abstract extractProducts(
    source: string,
    category: string,
    limit: number
  ): Promise<DiscoveredProduct[]>;

  /**
   * 捲動載入更多（共用實作，子類可覆寫）
   */
  protected async scrollToLoadMore(targetCount: number): Promise<void> {
    if (!this.page) return;

    const config = this.getScrollConfig();
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(targetCount / config.itemsPerScroll);

    while (scrollAttempts < maxScrolls) {
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(config.minDelay, config.maxDelay);

      // 等待 skeleton 消失（如果有配置）
      if (config.skeletonSelector) {
        try {
          await this.page.waitForFunction(
            (selector: string) => document.querySelectorAll(selector).length < 5,
            config.skeletonSelector,
            { timeout: config.skeletonTimeout || 5000 }
          );
        } catch {
          // 超時繼續
        }
      }

      const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
      scrollAttempts++;
    }
  }

  /**
   * 取得捲動配置（子類可覆寫）
   */
  protected getScrollConfig(): ScrollConfig {
    return {
      itemsPerScroll: 10,
      minDelay: 1000,
      maxDelay: 2000,
    };
  }

  /**
   * 輸出結果
   */
  protected async outputResults(products: DiscoveredProduct[], options: DiscoveryOptions): Promise<void> {
    const records = toJsonlRecords(products, this.config.platform, this.config.buildProductUrl);

    if (options.outputFile) {
      writeJsonlOutput(records, options.outputFile);
      console.log(`\n✅ 已輸出到 ${options.outputFile}（JSONL 格式）`);
    } else {
      printConsoleOutput(products, this.config.platform);
    }
  }

  /**
   * 清理資源
   */
  protected async cleanup(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}
