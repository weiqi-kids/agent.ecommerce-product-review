/**
 * ReviewSourceManager - 多來源評論聚合管理器
 *
 * 協調從多個平台（Amazon、Walmart、Best Buy）抓取並聚合評論。
 *
 * 用法：
 *   const manager = new ReviewSourceManager();
 *
 *   // 透過 Amazon ASIN 聚合所有來源
 *   const result = await manager.aggregateByAsin('B09V3KXJPB');
 *
 *   // 透過 UPC 聚合
 *   const result = await manager.aggregateByUpc('012345678901');
 *
 *   // 透過產品名稱聚合
 *   const result = await manager.aggregateByName('Sony WH-1000XM5');
 */

import type { Review, Product, RatingSummary } from './types.js';

export interface SourceResult {
  platform: 'amazon_us' | 'walmart_us' | 'bestbuy_us';
  product: Product | null;
  ratingSummary: RatingSummary | null;
  reviews: Review[];
  success: boolean;
  error?: string;
}

export interface AggregatedResult {
  primaryProduct: Product;
  sources: SourceResult[];
  totalReviews: number;
  allReviews: Review[];
  reviewsBySource: Record<string, Review[]>;
  matchConfidence: 'high' | 'medium' | 'low';
  matchMethod: 'upc' | 'sku' | 'name_search' | 'asin';
}

export interface SourceConfig {
  enabled: boolean;
  maxReviews: number;
  timeout: number;
}

export interface ManagerOptions {
  outputDir: string;
  headless: boolean;
  amazon: SourceConfig;
  walmart: SourceConfig;
  bestbuy: SourceConfig;
}

const DEFAULT_OPTIONS: ManagerOptions = {
  outputDir: './output',
  headless: true,
  amazon: { enabled: true, maxReviews: 20, timeout: 60000 },
  walmart: { enabled: true, maxReviews: 100, timeout: 60000 },
  bestbuy: { enabled: true, maxReviews: 100, timeout: 60000 },
};

/**
 * 多來源評論聚合管理器
 */
export class ReviewSourceManager {
  private options: ManagerOptions;

  constructor(options: Partial<ManagerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 透過 Amazon ASIN 聚合評論
   *
   * 流程：
   * 1. 從 Amazon 抓取產品資訊和評論（商品頁模式，不登入）
   * 2. 嘗試從 Amazon 頁面提取 UPC
   * 3. 使用 UPC 在 Walmart 和 Best Buy 搜尋對應產品
   * 4. 如果沒有 UPC，使用產品名稱搜尋
   */
  async aggregateByAsin(asin: string): Promise<AggregatedResult> {
    console.log(`\n🔄 開始多來源聚合: ASIN ${asin}`);

    const sources: SourceResult[] = [];
    let primaryProduct: Product | null = null;
    let upc: string | null = null;
    let productName: string | null = null;

    // Step 1: Amazon（主要來源）
    if (this.options.amazon.enabled) {
      console.log('\n📦 [1/3] Amazon...');
      const amazonResult = await this.fetchAmazon(asin);
      sources.push(amazonResult);

      if (amazonResult.success && amazonResult.product) {
        primaryProduct = amazonResult.product;
        upc = amazonResult.product.upc || null;
        productName = `${amazonResult.product.brand} ${amazonResult.product.title}`.slice(0, 100);
        console.log(`  ✅ ${amazonResult.reviews.length} 則評論`);
        if (upc) console.log(`  📋 UPC: ${upc}`);
      } else {
        console.log(`  ❌ ${amazonResult.error}`);
      }
    }

    // Step 2: Walmart（使用 UPC 或名稱搜尋）
    if (this.options.walmart.enabled) {
      console.log('\n🛒 [2/3] Walmart...');
      let walmartResult: SourceResult;

      if (upc) {
        walmartResult = await this.fetchWalmartByUpc(upc);
      } else if (productName) {
        walmartResult = await this.fetchWalmartByName(productName);
      } else {
        walmartResult = {
          platform: 'walmart_us',
          product: null,
          ratingSummary: null,
          reviews: [],
          success: false,
          error: 'No UPC or product name available',
        };
      }
      sources.push(walmartResult);

      if (walmartResult.success) {
        console.log(`  ✅ ${walmartResult.reviews.length} 則評論`);
      } else {
        console.log(`  ❌ ${walmartResult.error}`);
      }
    }

    // Step 3: Best Buy（使用 UPC 或名稱搜尋）
    if (this.options.bestbuy.enabled) {
      console.log('\n🏪 [3/3] Best Buy...');
      let bestbuyResult: SourceResult;

      if (upc) {
        bestbuyResult = await this.fetchBestBuyByUpc(upc);
      } else if (productName) {
        bestbuyResult = await this.fetchBestBuyByName(productName);
      } else {
        bestbuyResult = {
          platform: 'bestbuy_us',
          product: null,
          ratingSummary: null,
          reviews: [],
          success: false,
          error: 'No UPC or product name available',
        };
      }
      sources.push(bestbuyResult);

      if (bestbuyResult.success) {
        console.log(`  ✅ ${bestbuyResult.reviews.length} 則評論`);
      } else {
        console.log(`  ❌ ${bestbuyResult.error}`);
      }
    }

    return this.buildAggregatedResult(
      primaryProduct!,
      sources,
      upc ? 'upc' : 'name_search'
    );
  }

  /**
   * 透過 UPC 聚合評論
   */
  async aggregateByUpc(upc: string): Promise<AggregatedResult> {
    console.log(`\n🔄 開始多來源聚合: UPC ${upc}`);

    const sources: SourceResult[] = [];
    let primaryProduct: Product | null = null;

    // 平行抓取所有來源
    const [amazonResult, walmartResult, bestbuyResult] = await Promise.all([
      this.options.amazon.enabled
        ? this.fetchAmazonByUpc(upc)
        : this.emptyResult('amazon_us'),
      this.options.walmart.enabled
        ? this.fetchWalmartByUpc(upc)
        : this.emptyResult('walmart_us'),
      this.options.bestbuy.enabled
        ? this.fetchBestBuyByUpc(upc)
        : this.emptyResult('bestbuy_us'),
    ]);

    sources.push(amazonResult, walmartResult, bestbuyResult);

    // 選擇主要產品（優先 Amazon，其次評論最多的來源）
    for (const result of sources) {
      if (result.success && result.product) {
        if (!primaryProduct || result.platform === 'amazon_us') {
          primaryProduct = result.product;
        }
      }
    }

    if (!primaryProduct) {
      throw new Error(`No product found for UPC: ${upc}`);
    }

    return this.buildAggregatedResult(primaryProduct, sources, 'upc');
  }

  /**
   * 透過產品名稱聚合評論
   */
  async aggregateByName(name: string): Promise<AggregatedResult> {
    console.log(`\n🔄 開始多來源聚合: ${name}`);

    const sources: SourceResult[] = [];

    // 平行搜尋所有來源
    const [amazonResult, walmartResult, bestbuyResult] = await Promise.all([
      this.options.amazon.enabled
        ? this.fetchAmazonByName(name)
        : this.emptyResult('amazon_us'),
      this.options.walmart.enabled
        ? this.fetchWalmartByName(name)
        : this.emptyResult('walmart_us'),
      this.options.bestbuy.enabled
        ? this.fetchBestBuyByName(name)
        : this.emptyResult('bestbuy_us'),
    ]);

    sources.push(amazonResult, walmartResult, bestbuyResult);

    // 選擇評論最多的作為主要產品
    let primaryProduct: Product | null = null;
    let maxReviews = 0;

    for (const result of sources) {
      if (result.success && result.product && result.reviews.length > maxReviews) {
        primaryProduct = result.product;
        maxReviews = result.reviews.length;
      }
    }

    if (!primaryProduct) {
      throw new Error(`No product found for: ${name}`);
    }

    return this.buildAggregatedResult(primaryProduct, sources, 'name_search');
  }

  // === Private Methods ===

  private buildAggregatedResult(
    primaryProduct: Product,
    sources: SourceResult[],
    matchMethod: AggregatedResult['matchMethod']
  ): AggregatedResult {
    const allReviews: Review[] = [];
    const reviewsBySource: Record<string, Review[]> = {};
    let totalReviews = 0;

    for (const source of sources) {
      if (source.success) {
        // 標記評論來源
        const taggedReviews = source.reviews.map((r) => ({
          ...r,
          review_id: `${source.platform}:${r.review_id}`,
        }));

        allReviews.push(...taggedReviews);
        reviewsBySource[source.platform] = taggedReviews;
        totalReviews += source.reviews.length;
      }
    }

    // 計算匹配信心度
    const successCount = sources.filter((s) => s.success).length;
    let matchConfidence: AggregatedResult['matchConfidence'];
    if (matchMethod === 'upc' && successCount >= 2) {
      matchConfidence = 'high';
    } else if (matchMethod === 'name_search' && successCount >= 2) {
      matchConfidence = 'medium';
    } else {
      matchConfidence = 'low';
    }

    console.log(`\n📊 聚合完成:`);
    console.log(`  來源數: ${successCount}/${sources.length}`);
    console.log(`  總評論: ${totalReviews}`);
    console.log(`  信心度: ${matchConfidence}`);

    return {
      primaryProduct,
      sources,
      totalReviews,
      allReviews,
      reviewsBySource,
      matchConfidence,
      matchMethod,
    };
  }

  private emptyResult(platform: SourceResult['platform']): SourceResult {
    return {
      platform,
      product: null,
      ratingSummary: null,
      reviews: [],
      success: false,
      error: 'Source disabled',
    };
  }

  // === Amazon Methods ===

  private async fetchAmazon(asin: string): Promise<SourceResult> {
    // Amazon scraper requires special handling (auth, persistent context)
    // For now, return not implemented - caller should use Amazon scraper CLI directly
    // and pass the result to ReviewSourceManager
    return {
      platform: 'amazon_us',
      product: null,
      ratingSummary: null,
      reviews: [],
      success: false,
      error: 'Amazon direct fetch not implemented in manager - use CLI scraper directly',
    };
  }

  private async fetchAmazonByUpc(upc: string): Promise<SourceResult> {
    // Amazon 不直接支援 UPC 搜尋，需要先搜尋再抓取
    // 這裡可以透過 Amazon 搜尋功能實現
    return {
      platform: 'amazon_us',
      product: null,
      ratingSummary: null,
      reviews: [],
      success: false,
      error: 'UPC search not implemented for Amazon',
    };
  }

  private async fetchAmazonByName(name: string): Promise<SourceResult> {
    // 需要先在 Amazon 搜尋，找到 ASIN 再抓取
    return {
      platform: 'amazon_us',
      product: null,
      ratingSummary: null,
      reviews: [],
      success: false,
      error: 'Name search not implemented for Amazon',
    };
  }

  // === Walmart Methods ===

  private async fetchWalmartByUpc(upc: string): Promise<SourceResult> {
    try {
      const { scrapeByUpc } = await import('../walmart/scraper.js');

      const result = await scrapeByUpc({
        upc,
        maxReviews: this.options.walmart.maxReviews,
        headless: this.options.headless,
        timeout: this.options.walmart.timeout,
      });

      return {
        platform: 'walmart_us',
        product: result.product,
        ratingSummary: result.ratingSummary,
        reviews: result.reviews,
        success: true,
      };
    } catch (error) {
      return {
        platform: 'walmart_us',
        product: null,
        ratingSummary: null,
        reviews: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async fetchWalmartByName(name: string): Promise<SourceResult> {
    try {
      const { scrapeBySearch } = await import('../walmart/scraper.js');

      const result = await scrapeBySearch({
        query: name,
        maxReviews: this.options.walmart.maxReviews,
        headless: this.options.headless,
        timeout: this.options.walmart.timeout,
      });

      return {
        platform: 'walmart_us',
        product: result.product,
        ratingSummary: result.ratingSummary,
        reviews: result.reviews,
        success: true,
      };
    } catch (error) {
      return {
        platform: 'walmart_us',
        product: null,
        ratingSummary: null,
        reviews: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // === Best Buy Methods ===

  private async fetchBestBuyByUpc(upc: string): Promise<SourceResult> {
    try {
      const { scrapeByUpc } = await import('../bestbuy/scraper.js');

      const result = await scrapeByUpc({
        upc,
        maxReviews: this.options.bestbuy.maxReviews,
        headless: this.options.headless,
        timeout: this.options.bestbuy.timeout,
      });

      return {
        platform: 'bestbuy_us',
        product: result.product,
        ratingSummary: result.ratingSummary,
        reviews: result.reviews,
        success: true,
      };
    } catch (error) {
      return {
        platform: 'bestbuy_us',
        product: null,
        ratingSummary: null,
        reviews: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async fetchBestBuyByName(name: string): Promise<SourceResult> {
    try {
      const { scrapeBySearch } = await import('../bestbuy/scraper.js');

      const result = await scrapeBySearch({
        query: name,
        maxReviews: this.options.bestbuy.maxReviews,
        headless: this.options.headless,
        timeout: this.options.bestbuy.timeout,
      });

      return {
        platform: 'bestbuy_us',
        product: result.product,
        ratingSummary: result.ratingSummary,
        reviews: result.reviews,
        success: true,
      };
    } catch (error) {
      return {
        platform: 'bestbuy_us',
        product: null,
        ratingSummary: null,
        reviews: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 將聚合結果寫入 JSONL
 */
export function writeAggregatedJsonl(
  result: AggregatedResult,
  outputDir: string
): string {
  const { writeBatchedJsonl } = require('./output.js');

  // 使用主產品的 ASIN 或第一個可用 ID
  const productId =
    result.primaryProduct.asin ||
    result.primaryProduct.sku ||
    result.primaryProduct.walmart_id ||
    'unknown';

  // 計算合併的評分
  const combinedRating: RatingSummary = {
    average: 0,
    total_count: result.totalReviews,
    distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
  };

  // 加總各來源的評分分佈
  for (const source of result.sources) {
    if (source.success && source.ratingSummary) {
      for (const [star, count] of Object.entries(source.ratingSummary.distribution)) {
        combinedRating.distribution[star] =
          (combinedRating.distribution[star] || 0) + count;
      }
    }
  }

  // 計算加權平均
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [star, count] of Object.entries(combinedRating.distribution)) {
    totalWeight += count;
    weightedSum += parseInt(star) * count;
  }
  combinedRating.average = totalWeight > 0 ? weightedSum / totalWeight : 0;
  combinedRating.average = Math.round(combinedRating.average * 10) / 10;

  // 寫入 JSONL
  return writeBatchedJsonl(
    result.primaryProduct,
    combinedRating,
    result.allReviews,
    {
      platform: 'multi_source',
      scraped_at: new Date().toISOString(),
      source_url: `aggregated:${productId}`,
      locale: 'en-US',
    },
    {
      batchSize: 50,
      outputDir,
      platform: 'multi_source',
    }
  );
}
