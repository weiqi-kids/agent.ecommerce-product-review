/**
 * Walmart 商品評論爬蟲
 *
 * 用法：
 *   # 抓取評論（不需登入）
 *   npx tsx src/walmart/scraper.ts \
 *     --url "https://www.walmart.com/ip/123456789" \
 *     --output "./output" \
 *     --max-reviews 100
 *
 *   # 透過 UPC 搜尋並抓取
 *   npx tsx src/walmart/scraper.ts \
 *     --upc "012345678901" \
 *     --output "./output"
 *
 *   # 透過產品名稱搜尋
 *   npx tsx src/walmart/scraper.ts \
 *     --search "Sony WH-1000XM5" \
 *     --output "./output"
 */

import { launchBrowser, createContext, createPage, randomDelay } from '../common/browser.js';
import { writeBatchedJsonl, parseCliArgs } from '../common/output.js';
import { parseProduct, parseRatingSummary, parseReview } from './parser.js';
import {
  SELECTORS,
  extractProductIdFromUrl,
  buildReviewsUrl,
  buildSearchByUpcUrl,
  buildSearchByNameUrl
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
    const productUrl = await searchForProduct(page, upc, undefined);

    if (!productUrl) {
      throw new Error(`No product found for UPC: ${upc}`);
    }

    return await scrapeProductUrl(page, productUrl, maxReviews);
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
    const productUrl = await searchForProduct(page, undefined, query);

    if (!productUrl) {
      throw new Error(`No product found for query: ${query}`);
    }

    return await scrapeProductUrl(page, productUrl, maxReviews);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 透過 URL 抓取評論（供 ReviewSourceManager 使用）
 */
export async function scrapeByUrl(
  options: ScrapeOptions & { url: string }
): Promise<ScrapeResult> {
  const { url, maxReviews = 100, headless = true, timeout = 30000 } = options;

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);
    return await scrapeProductUrl(page, url, maxReviews);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 內部函數：從產品 URL 抓取
 */
async function scrapeProductUrl(
  page: Page,
  productUrl: string,
  maxReviews: number
): Promise<ScrapeResult> {
  const productId = extractProductIdFromUrl(productUrl);
  if (!productId) {
    throw new Error(`Cannot extract product ID from URL: ${productUrl}`);
  }

  // 載入商品頁面
  await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  await randomDelay(2000, 4000);

  // 解析商品資訊
  const product = await parseProduct(page, productUrl);
  const ratingSummary = await parseRatingSummary(page);
  product.seller.store_id = productId;
  if (productId) {
    product.walmart_id = productId;
  }

  // 抓取評論
  const reviews: Review[] = [];
  const seenIds = new Set<string>();
  await scrapeReviews(page, productId, maxReviews, reviews, seenIds);

  return { product, ratingSummary, reviews };
}

async function main() {
  const args = parseCliArgs();

  const url = args['url'];
  const upc = args['upc'];
  const searchQuery = args['search'];
  const outputDir = args['output'] || './output';
  const maxReviews = parseInt(args['max-reviews'] || '100', 10);
  const batchSize = parseInt(args['batch-size'] || '50', 10);
  const headless = args['headless'] !== 'false';
  const timeout = parseInt(args['timeout'] || '30000', 10);

  if (!url && !upc && !searchQuery) {
    console.error('❌ 需要提供 --url, --upc, 或 --search 參數');
    console.error('');
    console.error('用法：');
    console.error('  URL：npx tsx src/walmart/scraper.ts --url "https://www.walmart.com/ip/123456789"');
    console.error('  UPC：npx tsx src/walmart/scraper.ts --upc "012345678901"');
    console.error('  搜尋：npx tsx src/walmart/scraper.ts --search "Sony WH-1000XM5"');
    process.exit(1);
  }

  console.log('🛒 Walmart Scraper');

  const browser = await launchBrowser({ headless, timeout, locale: 'en-US' });
  const context = await createContext(browser, { locale: 'en-US', timeout });

  try {
    const page = await createPage(context);

    let productUrl: string | null = url || null;
    let productId: string | null = null;

    // 如果提供 UPC 或搜尋字串，先搜尋找到產品
    if (!productUrl && (upc || searchQuery)) {
      productUrl = await searchForProduct(page, upc, searchQuery);
      if (!productUrl) {
        console.error('❌ 搜尋不到對應產品');
        process.exit(1);
      }
    }

    productId = extractProductIdFromUrl(productUrl!);
    if (!productId) {
      console.error('❌ 無法從 URL 提取產品 ID');
      process.exit(1);
    }

    console.log(`📦 Product ID: ${productId}`);

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

    // 加入 product_id 到 seller.store_id
    product.seller.store_id = productId;

    console.log(`  標題: ${product.title.slice(0, 80)}...`);
    console.log(`  品牌: ${product.brand}`);
    console.log(`  評分: ${ratingSummary.average} (${ratingSummary.total_count} 則)`);

    // Step 3: 抓取評論
    console.log(`📝 開始抓取評論 (最多 ${maxReviews} 則)...`);
    const reviews: Review[] = [];
    const seenIds = new Set<string>();

    await scrapeReviews(page, productId, maxReviews, reviews, seenIds);

    console.log(`\n📊 共抓取 ${reviews.length} 則評論`);

    // Step 4: 寫入 JSONL
    // 使用 product_id 作為識別（因為 Walmart 沒有 ASIN）
    const productForOutput: Product = {
      ...product,
      asin: productId, // 暫時用 product_id 填充 asin 欄位，以便 output.ts 產生檔名
    };

    const filepath = writeBatchedJsonl(
      productForOutput,
      ratingSummary,
      reviews,
      {
        platform: 'walmart_us',
        scraped_at: new Date().toISOString(),
        source_url: productUrl!,
        locale: 'en-US',
      },
      {
        batchSize,
        outputDir,
        platform: 'walmart_us',
      }
    );

    console.log(`\n✅ 完成！輸出：${filepath}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 透過 UPC 或搜尋字串找到產品 URL
 */
async function searchForProduct(
  page: Page,
  upc?: string,
  searchQuery?: string
): Promise<string | null> {
  const searchUrl = upc
    ? buildSearchByUpcUrl(upc)
    : buildSearchByNameUrl(searchQuery!);

  console.log(`🔍 搜尋產品: ${upc || searchQuery}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 找到第一個搜尋結果
  const firstResult = await page.$(SELECTORS.search.productLink);
  if (firstResult) {
    const href = await firstResult.getAttribute('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `https://www.walmart.com${href}`;
      console.log(`  ✅ 找到產品: ${fullUrl.slice(0, 80)}...`);
      return fullUrl;
    }
  }

  return null;
}

/**
 * 抓取評論（從評論頁面）
 */
async function scrapeReviews(
  page: Page,
  productId: string,
  maxReviews: number,
  reviews: Review[],
  seenIds: Set<string>
): Promise<void> {
  let pageNumber = 1;
  let consecutiveEmptyPages = 0;

  while (reviews.length < maxReviews && consecutiveEmptyPages < 3) {
    // 導航到評論頁
    const reviewsUrl = buildReviewsUrl(productId, pageNumber);
    console.log(`  📄 評論頁 ${pageNumber}...`);

    if (pageNumber === 1) {
      await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
    } else {
      // 嘗試點擊下一頁按鈕
      const nextButton = await page.$(SELECTORS.reviews.pagination.nextPage);
      if (nextButton) {
        await nextButton.scrollIntoViewIfNeeded();
        await randomDelay(300, 600);
        await nextButton.click();
      } else {
        // 直接導航
        await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
      }
    }

    await randomDelay(2000, 3000);

    // 檢查是否被 PerimeterX 封鎖
    const pageTitle = await page.title();
    const isPxBlocked = await page.$('script[src*="perimeterx"]') !== null;
    const isRobotCheck = pageTitle.toLowerCase().includes('robot') ||
                         pageTitle.toLowerCase().includes('verify') ||
                         pageTitle.toLowerCase().includes('blocked');

    if (isPxBlocked || isRobotCheck) {
      console.log('  ⚠️ 被 PerimeterX 反機器人系統封鎖，評論頁無法存取');
      console.log(`  📄 頁面標題: ${pageTitle}`);
      throw new Error('BLOCKED_BY_PERIMETERX: Walmart 反機器人系統封鎖了評論頁面存取');
    }

    // 等待評論元素
    try {
      await page.waitForSelector(SELECTORS.reviews.container, { timeout: 10000 });
    } catch {
      console.log('  ⏳ 等待評論元素超時...');
    }

    // 捲動載入更多
    await page.evaluate(() => window.scrollBy(0, 500));
    await randomDelay(500, 1000);

    // 取得評論元素
    let reviewElements = await page.$$(SELECTORS.reviews.container);

    // 嘗試備用選擇器
    if (reviewElements.length === 0) {
      for (const fallback of SELECTORS.reviews.containerFallbacks) {
        reviewElements = await page.$$(fallback);
        if (reviewElements.length > 0) break;
      }
    }

    if (reviewElements.length === 0) {
      // 檢查頁面是否正常載入（非封鎖頁面）
      const hasProductInfo = await page.$('[data-testid="product-title"], .prod-ProductTitle') !== null;
      const hasReviewSection = await page.$('[data-testid="reviews-section"], .customer-reviews') !== null;

      if (!hasProductInfo && !hasReviewSection) {
        console.log('  ⚠️ 頁面可能被封鎖或載入異常，無法取得評論');
        throw new Error('PAGE_LOAD_FAILED: 無法正常載入評論頁面，可能被反爬蟲系統攔截');
      }

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

    // 追蹤連續空頁
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
