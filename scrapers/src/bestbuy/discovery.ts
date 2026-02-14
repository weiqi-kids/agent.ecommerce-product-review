/**
 * Best Buy 熱門商品發現爬蟲
 *
 * 支援 4 種資料源：
 *   - top-rated: 高評價產品
 *   - best-sellers: 銷售排行榜
 *   - deals: 特價商品
 *   - new-arrivals: 新品上架
 *
 * 用法：
 *   # 抓取電子產品 Best Sellers 前 50 名
 *   npx tsx src/bestbuy/discovery.ts --source best-sellers --category electronics --limit 50
 *
 *   # 抓取所有來源的電腦產品
 *   npx tsx src/bestbuy/discovery.ts --source all --category computers --limit 20
 *
 *   # 輸出到檔案（JSONL 格式）
 *   npx tsx src/bestbuy/discovery.ts --source best-sellers --output ./discovered.jsonl
 *
 * 注意：Best Buy 有較強的反爬蟲機制，headless 模式可能無法正常運作。
 *       建議使用 --headless false 開啟瀏覽器視窗執行。
 */

import { launchBrowser, createContext, createPage, randomDelay } from '../common/browser.js';
import { parseCliArgs } from '../common/output.js';
import type { Page } from 'playwright';
import { DISCOVERY_SELECTORS, extractSkuFromUrl } from './selectors.js';

// Best Buy 熱門頁面 URL 模板（2026 年更新格式）
const DISCOVERY_URLS: Record<string, string> = {
  'top-rated': 'https://www.bestbuy.com/site/promo/top-rated-products',
  'best-sellers': 'https://www.bestbuy.com/site/promo/best-sellers',
  'deals': 'https://www.bestbuy.com/site/promo/tv-deals',  // TV deals 作為 deals 示例
  'new-arrivals': 'https://www.bestbuy.com/site/promo/new-arrivals',
};

// 品類對應的 category ID（用於過濾）
const CATEGORY_PATHS: Record<string, string> = {
  electronics: 'abcat0100000',
  computers: 'abcat0500000',
  'cell-phones': 'abcat0800000',
  appliances: 'abcat0900000',
  tv: 'abcat0101000',
  audio: 'abcat0200000',
  cameras: 'abcat0400000',
  gaming: 'abcat0700000',
  wearables: 'pcmcat332000050000',
  'smart-home': 'pcmcat254000050002',
  all: '', // 全站
};

interface DiscoveredProduct {
  sku: string;
  title: string;
  rank: number;
  price?: string;
  rating?: string;
  reviewCount?: string;
  source: string;
  category: string;
}

async function main() {
  const args = parseCliArgs();

  const source = args['source'] || 'best-sellers';
  const category = args['category'] || 'electronics';
  const limit = parseInt(args['limit'] || '50', 10);
  const outputFile = args['output'];
  const headless = args['headless'] !== 'false';

  // 驗證參數
  const validSources = ['top-rated', 'best-sellers', 'deals', 'new-arrivals', 'all'];
  if (!validSources.includes(source)) {
    console.error(`❌ 無效的 source: ${source}`);
    console.error(`   有效值: ${validSources.join(', ')}`);
    process.exit(1);
  }

  const categoryId = CATEGORY_PATHS[category];
  if (categoryId === undefined) {
    console.error(`❌ 無效的 category: ${category}`);
    console.error(`   有效值: ${Object.keys(CATEGORY_PATHS).join(', ')}`);
    process.exit(1);
  }

  console.log(`🔍 Best Buy 商品發現: source=${source}, category=${category}, limit=${limit}`);

  const browser = await launchBrowser({ headless, timeout: 60000 });
  const context = await createContext(browser, {
    locale: 'en-US',
    timeout: 60000,
    geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    permissions: ['geolocation'],
  });

  // 設定 cookies 跳過國家選擇頁面
  await context.addCookies([
    { name: 'intl_splash', value: 'false', domain: '.bestbuy.com', path: '/' },
    { name: 'UID', value: 'US', domain: '.bestbuy.com', path: '/' },
  ]);

  try {
    const page = await createPage(context);
    const allProducts: DiscoveredProduct[] = [];

    // 決定要抓取哪些來源
    const sourcesToScrape = source === 'all'
      ? ['top-rated', 'best-sellers', 'deals', 'new-arrivals']
      : [source];

    for (const src of sourcesToScrape) {
      console.log(`\n📊 抓取 ${src}...`);
      const products = await scrapeDiscoveryPage(page, src, categoryId, category, limit);
      allProducts.push(...products);
      console.log(`   ✅ 找到 ${products.length} 個商品`);

      // 來源之間加入延遲
      if (sourcesToScrape.length > 1) {
        await randomDelay(2000, 4000);
      }
    }

    // 去重（同一 SKU 可能出現在多個列表）
    const uniqueProducts = deduplicateProducts(allProducts);
    console.log(`\n📦 共發現 ${uniqueProducts.length} 個不重複商品`);

    // 如果沒找到商品，顯示警告
    if (uniqueProducts.length === 0 && headless) {
      console.log(`\n⚠️  未找到商品。Best Buy 有較強的反爬蟲機制。`);
      console.log(`   建議使用 --headless false 開啟瀏覽器視窗執行。`);
    }

    // 輸出結果
    if (outputFile) {
      const { writeFileSync, mkdirSync } = await import('fs');
      const { dirname } = await import('path');

      // 確保目錄存在
      mkdirSync(dirname(outputFile), { recursive: true });

      // 輸出 JSONL 格式，每行一個產品
      // 根據 ID 格式選擇 URL：7 位數字用舊格式，其他用新格式
      const lines = uniqueProducts.map(p => {
        const isOldFormat = /^\d{7}$/.test(p.sku);
        const url = isOldFormat
          ? `https://www.bestbuy.com/site/${p.sku}.p`
          : `https://www.bestbuy.com/product/${p.sku}`;
        return JSON.stringify({
          sku: p.sku,
          title: p.title,
          rank: p.rank,
          price: p.price || null,
          rating: p.rating || null,
          review_count: p.reviewCount || null,
          source: p.source,
          category: p.category,
          url,
        });
      });
      writeFileSync(outputFile, lines.join('\n') + '\n');
      console.log(`\n✅ 已輸出到 ${outputFile}（JSONL 格式）`);
    } else {
      // 輸出到 console
      console.log('\n--- 發現的商品 ---');
      for (const p of uniqueProducts.slice(0, 20)) {
        console.log(`[${p.rank}] ${p.sku} - ${p.title.slice(0, 60)}...`);
      }
      if (uniqueProducts.length > 20) {
        console.log(`... 還有 ${uniqueProducts.length - 20} 個商品`);
      }

      // 輸出 SKU 列表方便複製
      console.log('\n--- SKU 列表 ---');
      console.log(uniqueProducts.map(p => p.sku).join('\n'));
    }

  } finally {
    await context.close();
    await browser.close();
  }
}

async function scrapeDiscoveryPage(
  page: Page,
  source: string,
  categoryId: string,
  categoryName: string,
  limit: number
): Promise<DiscoveredProduct[]> {
  let url = DISCOVERY_URLS[source];

  // 如果有品類過濾，加入 URL 參數
  if (categoryId) {
    url += `?qp=category_facet%3DCategory~${categoryId}`;
  }

  console.log(`   📄 載入 ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 等待商品列表載入
  try {
    await page.waitForSelector('.sku-item, [data-sku-id]', { timeout: 10000 });
  } catch {
    console.log(`   ⚠️ 未找到商品元素，嘗試其他選擇器`);
  }

  // 捲動載入更多商品
  await scrollToLoadMore(page, limit);

  // 提取商品資訊
  const products = await extractProducts(page, source, categoryName, limit);

  return products;
}

async function scrollToLoadMore(page: Page, targetCount: number): Promise<void> {
  let lastHeight = 0;
  let scrollAttempts = 0;
  const maxScrolls = Math.ceil(targetCount / 10); // 大約每次捲動載入 10 個

  while (scrollAttempts < maxScrolls) {
    // 捲動到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(1000, 2000);

    // 檢查是否有新內容
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) {
      break; // 沒有更多內容
    }
    lastHeight = newHeight;
    scrollAttempts++;
  }
}

async function extractProducts(
  page: Page,
  source: string,
  category: string,
  limit: number
): Promise<DiscoveredProduct[]> {
  const products: DiscoveredProduct[] = [];

  // Best Buy 商品選擇器
  const selectors = DISCOVERY_SELECTORS.productGrid;

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length === 0) continue;

    console.log(`   使用選擇器: ${selector} (找到 ${elements.length} 個)`);

    let rank = 1;
    for (const el of elements) {
      if (products.length >= limit) break;

      try {
        // 提取產品 ID（支援新舊格式）
        let productId = await el.getAttribute('data-sku-id');
        let productUrl = '';

        if (!productId) {
          // 嘗試從連結提取（優先新格式 /product/，然後舊格式 .p）
          const link = await el.$('a[href*="/product/"], a[href*=".p"]');
          if (link) {
            const href = await link.getAttribute('href');
            if (href) {
              productUrl = href;
              productId = extractSkuFromUrl(href);
            }
          }
        }

        // 驗證產品 ID（新格式為字母數字，舊格式為 7 位數字）
        if (!productId || productId.length < 5) continue;

        // 提取標題
        const titleEl = await el.$('h4, .sku-title, .sku-header a, h4.sku-title, [class*="title"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

        // 提取價格
        const priceEl = await el.$('[class*="price"], .priceView-customer-price span');
        const price = priceEl ? (await priceEl.textContent())?.trim() || '' : '';

        // 提取評分
        const ratingEl = await el.$('.c-ratings-reviews .ugc-c-review-average, .c-ratings-reviews-v4 .c-ratings-reviews');
        let rating = '';
        if (ratingEl) {
          const ratingText = await ratingEl.getAttribute('aria-label');
          rating = ratingText || (await ratingEl.textContent())?.trim() || '';
        }

        // 提取評論數
        const reviewEl = await el.$('.c-reviews .c-total-reviews, .c-ratings-reviews-v4 .c-total-reviews');
        const reviewCount = reviewEl ? (await reviewEl.textContent())?.trim() || '' : '';

        // 檢查是否已存在
        if (!products.find(p => p.sku === productId)) {
          products.push({
            sku: productId!,
            title: title || `Product ${productId}`,
            rank,
            price,
            rating,
            reviewCount,
            source,
            category,
          });
        }

        rank++;
      } catch (err) {
        // 忽略單個元素錯誤
        continue;
      }
    }

    if (products.length > 0) break; // 已找到商品，不需要嘗試其他選擇器
  }

  return products;
}

function deduplicateProducts(products: DiscoveredProduct[]): DiscoveredProduct[] {
  const seen = new Map<string, DiscoveredProduct>();

  for (const p of products) {
    if (!seen.has(p.sku)) {
      seen.set(p.sku, p);
    } else {
      // 保留排名較高的
      const existing = seen.get(p.sku)!;
      if (p.rank < existing.rank) {
        seen.set(p.sku, p);
      }
    }
  }

  // 按排名排序
  return Array.from(seen.values()).sort((a, b) => a.rank - b.rank);
}

main().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
