/**
 * Best Buy 商品評論爬蟲
 *
 * 用法：
 *   # 抓取評論（不需登入）
 *   npx tsx src/bestbuy/scraper.ts \
 *     --url "https://www.bestbuy.com/site/1234567.p" \
 *     --output "./output"
 *
 *   # 透過 UPC 搜尋並抓取
 *   npx tsx src/bestbuy/scraper.ts \
 *     --upc "012345678901" \
 *     --output "./output"
 *
 *   # 透過 SKU 直接抓取
 *   npx tsx src/bestbuy/scraper.ts \
 *     --sku "1234567" \
 *     --output "./output"
 */

import { launchBrowser, createContext, createPage, randomDelay } from '../common/browser.js';
import { writeBatchedJsonl, parseCliArgs } from '../common/output.js';
import { parseProduct, parseRatingSummary, parseReview } from './parser.js';
import {
  SELECTORS,
  extractSkuFromUrl,
  buildReviewsUrl,
  buildSearchByUpcUrl,
  buildSearchByNameUrl,
  buildProductUrl
} from './selectors.js';
import type { Review, Product, RatingSummary } from '../common/types.js';
import type { Page, Browser, BrowserContext } from 'playwright';

// === Exported Types ===

export interface ScrapeOptions {
  maxReviews?: number;
  headless?: boolean;
  timeout?: number;
}

export interface ScrapeResult {
  product: Product;
  ratingSummary: RatingSummary;
  reviews: Review[];
}

// === Exported Functions for Programmatic Use ===

/**
 * 透過 UPC 抓取評論（供 ReviewSourceManager 使用）
 */
export async function scrapeByUpc(
  options: ScrapeOptions & { upc: string }
): Promise<ScrapeResult> {
  const { upc, maxReviews = 100, headless = true, timeout = 30000 } = options;

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);
    const result = await searchForProduct(page, upc, undefined);

    if (!result) {
      throw new Error(`No product found for UPC: ${upc}`);
    }

    return await scrapeProductBySku(page, result.sku, result.url, maxReviews);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 透過搜尋關鍵字抓取評論（供 ReviewSourceManager 使用）
 */
export async function scrapeBySearch(
  options: ScrapeOptions & { query: string }
): Promise<ScrapeResult> {
  const { query, maxReviews = 100, headless = true, timeout = 30000 } = options;

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);
    const result = await searchForProduct(page, undefined, query);

    if (!result) {
      throw new Error(`No product found for query: ${query}`);
    }

    return await scrapeProductBySku(page, result.sku, result.url, maxReviews);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 透過 SKU 抓取評論（供 ReviewSourceManager 使用）
 */
export async function scrapeBySkuDirect(
  options: ScrapeOptions & { sku: string }
): Promise<ScrapeResult> {
  const { sku, maxReviews = 100, headless = true, timeout = 30000 } = options;

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);
    const productUrl = buildProductUrl(sku);
    return await scrapeProductBySku(page, sku, productUrl, maxReviews);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 內部函數：從 SKU 抓取
 */
async function scrapeProductBySku(
  page: Page,
  sku: string,
  productUrl: string,
  maxReviews: number
): Promise<ScrapeResult> {
  // 載入商品頁面
  await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  await randomDelay(2000, 4000);

  // 模擬人類捲動
  await page.evaluate(() => {
    window.scrollTo({ top: Math.random() * 500 + 200, behavior: 'smooth' });
  });
  await randomDelay(500, 1000);

  // 解析商品資訊
  const product = await parseProduct(page, productUrl);
  const ratingSummary = await parseRatingSummary(page);

  // 確保 SKU 正確
  product.sku = sku;
  product.seller.store_id = sku;

  // 抓取評論
  const reviews: Review[] = [];
  const seenIds = new Set<string>();
  await scrapeReviews(page, sku, maxReviews, reviews, seenIds);

  return { product, ratingSummary, reviews };
}

async function main() {
  const args = parseCliArgs();

  const url = args['url'];
  const sku = args['sku'];
  const upc = args['upc'];
  const searchQuery = args['search'];
  const outputDir = args['output'] || './output';
  const maxReviews = parseInt(args['max-reviews'] || '100', 10);
  const batchSize = parseInt(args['batch-size'] || '50', 10);
  const headless = args['headless'] !== 'false';
  const timeout = parseInt(args['timeout'] || '30000', 10);

  if (!url && !sku && !upc && !searchQuery) {
    console.error('❌ 需要提供 --url, --sku, --upc, 或 --search 參數');
    console.error('');
    console.error('用法：');
    console.error('  URL：npx tsx src/bestbuy/scraper.ts --url "https://www.bestbuy.com/site/1234567.p"');
    console.error('  SKU：npx tsx src/bestbuy/scraper.ts --sku "1234567"');
    console.error('  UPC：npx tsx src/bestbuy/scraper.ts --upc "012345678901"');
    console.error('  搜尋：npx tsx src/bestbuy/scraper.ts --search "Sony WH-1000XM5"');
    process.exit(1);
  }

  console.log('🛒 Best Buy Scraper');

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);

    let productUrl = url;
    let productSku: string | null = sku || null;

    // 如果提供 SKU，直接構建 URL
    if (!productUrl && productSku) {
      productUrl = buildProductUrl(productSku);
    }

    // 如果提供 UPC 或搜尋字串，先搜尋找到產品
    if (!productUrl && (upc || searchQuery)) {
      const result = await searchForProduct(page, upc, searchQuery);
      if (!result) {
        console.error('❌ 搜尋不到對應產品');
        process.exit(1);
      }
      productUrl = result.url;
      productSku = result.sku;
    }

    if (!productSku) {
      productSku = extractSkuFromUrl(productUrl!);
    }

    if (!productSku) {
      console.error('❌ 無法從 URL 提取 SKU');
      process.exit(1);
    }

    console.log(`📦 SKU: ${productSku}`);

    // Step 1: 載入商品頁面
    console.log('📄 載入商品頁面...');
    await page.goto(productUrl!, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await randomDelay(2000, 4000);

    // 模擬人類捲動
    await page.evaluate(() => {
      window.scrollTo({ top: Math.random() * 500 + 200, behavior: 'smooth' });
    });
    await randomDelay(500, 1000);

    // Step 2: 解析商品資訊
    console.log('🔍 解析商品資訊...');
    const product = await parseProduct(page, productUrl!);
    const ratingSummary = await parseRatingSummary(page);

    // 確保 SKU 正確
    product.sku = productSku;
    product.seller.store_id = productSku;

    console.log(`  標題: ${product.title.slice(0, 80)}...`);
    console.log(`  品牌: ${product.brand}`);
    console.log(`  評分: ${ratingSummary.average} (${ratingSummary.total_count} 則)`);

    // Step 3: 抓取評論
    console.log(`📝 開始抓取評論 (最多 ${maxReviews} 則)...`);
    const reviews: Review[] = [];
    const seenIds = new Set<string>();

    await scrapeReviews(page, productSku, maxReviews, reviews, seenIds);

    console.log(`\n📊 共抓取 ${reviews.length} 則評論`);

    // Step 4: 寫入 JSONL
    // 用 SKU 作為產品識別
    const productForOutput: Product = {
      ...product,
      asin: productSku, // 使用 asin 欄位存 SKU 以便 output.ts 產生檔名
    };

    const filepath = writeBatchedJsonl(
      productForOutput,
      ratingSummary,
      reviews,
      {
        platform: 'bestbuy_us',
        scraped_at: new Date().toISOString(),
        source_url: productUrl!,
        locale: 'en-US',
      },
      {
        batchSize,
        outputDir,
        platform: 'bestbuy_us',
      }
    );

    console.log(`\n✅ 完成！輸出：${filepath}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 透過 UPC 或搜尋字串找到產品
 */
async function searchForProduct(
  page: Page,
  upc?: string,
  searchQuery?: string
): Promise<{ url: string; sku: string } | null> {
  const searchUrl = upc
    ? buildSearchByUpcUrl(upc)
    : buildSearchByNameUrl(searchQuery!);

  console.log(`🔍 搜尋產品: ${upc || searchQuery}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 找到第一個搜尋結果
  const firstResult = await page.$(SELECTORS.search.results);
  if (firstResult) {
    const sku = await firstResult.getAttribute('data-sku-id');
    const linkEl = await firstResult.$(SELECTORS.search.productLink);
    if (linkEl && sku) {
      const href = await linkEl.getAttribute('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.bestbuy.com${href}`;
        console.log(`  ✅ 找到產品: SKU ${sku}`);
        return { url: fullUrl, sku };
      }
    }
  }

  return null;
}

/**
 * 抓取評論
 */
async function scrapeReviews(
  page: Page,
  sku: string,
  maxReviews: number,
  reviews: Review[],
  seenIds: Set<string>
): Promise<void> {
  let pageNumber = 1;
  let consecutiveEmptyPages = 0;

  while (reviews.length < maxReviews && consecutiveEmptyPages < 3) {
    // 導航到評論頁
    const reviewsUrl = buildReviewsUrl(sku, pageNumber);
    console.log(`  📄 評論頁 ${pageNumber}...`);

    if (pageNumber === 1) {
      await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
    } else {
      // 嘗試點擊下一頁
      const nextButton = await page.$(SELECTORS.reviews.pagination.nextPage);
      if (nextButton) {
        await nextButton.scrollIntoViewIfNeeded();
        await randomDelay(300, 600);
        await nextButton.click();
      } else {
        await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
      }
    }

    await randomDelay(2000, 3000);

    // 等待評論載入
    try {
      await page.waitForSelector(SELECTORS.reviews.container, { timeout: 10000 });
    } catch {
      console.log('  ⏳ 等待評論元素超時...');
    }

    // 捲動
    await page.evaluate(() => window.scrollBy(0, 500));
    await randomDelay(500, 1000);

    // 取得評論
    let reviewElements = await page.$$(SELECTORS.reviews.container);

    if (reviewElements.length === 0) {
      for (const fallback of SELECTORS.reviews.containerFallbacks) {
        reviewElements = await page.$$(fallback);
        if (reviewElements.length > 0) break;
      }
    }

    if (reviewElements.length === 0) {
      console.log('  ⚠️ 無更多評論');
      break;
    }

    let newCount = 0;
    let dupCount = 0;

    for (const element of reviewElements) {
      if (reviews.length >= maxReviews) break;

      const review = await parseReview(element);
      if (review) {
        if (!seenIds.has(review.review_id)) {
          seenIds.add(review.review_id);
          reviews.push(review);
          newCount++;
        } else {
          dupCount++;
        }
      }
    }

    console.log(`  ✅ 已抓取 ${reviews.length} 則 (本頁新增 ${newCount}, 重複 ${dupCount})`);

    if (newCount === 0) {
      consecutiveEmptyPages++;
    } else {
      consecutiveEmptyPages = 0;
    }

    pageNumber++;
  }

  if (consecutiveEmptyPages >= 3) {
    console.log('  ⚠️ 連續 3 頁無新評論，停止抓取');
  }
}

main().catch((err) => {
  console.error('❌ 爬蟲執行失敗:', err);
  process.exit(1);
});
