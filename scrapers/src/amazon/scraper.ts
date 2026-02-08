/**
 * Amazon 商品評論爬蟲
 *
 * 用法：
 *   # 首次使用：登入 Amazon（開啟瀏覽器手動登入）
 *   npx tsx src/amazon/scraper.ts --login
 *
 *   # 已登入：抓取評論（可抓取完整評論頁）
 *   npx tsx src/amazon/scraper.ts \
 *     --url "https://www.amazon.com/dp/B09V3KXJPB" \
 *     --output "./output" \
 *     --max-reviews 500
 *
 *   # 未登入：僅抓取商品頁評論（約 8-15 則）
 *   npx tsx src/amazon/scraper.ts \
 *     --url "https://www.amazon.com/dp/B09V3KXJPB" \
 *     --no-auth
 */

import { launchBrowser, createContext, createPage, randomDelay, launchPersistentContext, getDefaultProfileDir } from '../common/browser.js';
import { writeBatchedJsonl, parseCliArgs } from '../common/output.js';
import { parseProduct, parseRatingSummary, parseReview } from './parser.js';
import { SELECTORS, extractAsinFromUrl, buildReviewsUrl, AMAZON_DOMAINS } from './selectors.js';
import { interactiveLogin, isLoggedIn, isSessionExpired } from './auth.js';
import type { Review } from '../common/types.js';
import type { BrowserContext, Page } from 'playwright';

async function main() {
  const args = parseCliArgs();

  // 登入模式
  if (args['login'] === 'true') {
    const locale = args['locale'] || 'en-US';
    await interactiveLogin(locale);
    return;
  }

  const url = args['url'];
  const outputDir = args['output'] || './output';
  const locale = args['locale'] || 'en-US';
  const maxReviews = parseInt(args['max-reviews'] || '500', 10);
  const batchSize = parseInt(args['batch-size'] || '50', 10);
  const headless = args['headless'] !== 'false';
  const timeout = parseInt(args['timeout'] || '30000', 10);
  const noAuth = args['no-auth'] === 'true';

  if (!url) {
    console.error('❌ 缺少 --url 參數');
    console.error('');
    console.error('用法：');
    console.error('  登入：npx tsx src/amazon/scraper.ts --login');
    console.error('  抓取：npx tsx src/amazon/scraper.ts --url "https://www.amazon.com/dp/ASIN"');
    process.exit(1);
  }

  const asin = extractAsinFromUrl(url);
  if (!asin) {
    console.error('❌ 無法從 URL 提取 ASIN');
    process.exit(1);
  }

  const domain = AMAZON_DOMAINS[locale] || 'www.amazon.com';
  console.log(`🛒 Amazon Scraper: ${asin} @ ${domain} (locale: ${locale})`);

  let context: BrowserContext;
  let useAuth = !noAuth;

  // 嘗試使用已登入的 session
  if (useAuth) {
    try {
      const profileDir = getDefaultProfileDir('amazon');
      context = await launchPersistentContext({
        userDataDir: profileDir,
        headless,
        locale,
        timeout,
      });
      console.log('🔐 使用已保存的登入狀態');
    } catch {
      console.log('⚠️ 無法載入登入狀態，使用未登入模式');
      useAuth = false;
      const browser = await launchBrowser({ headless, timeout, locale });
      context = await createContext(browser, { locale, timeout });
    }
  } else {
    const browser = await launchBrowser({ headless, timeout, locale });
    context = await createContext(browser, { locale, timeout });
  }

  try {
    const page = await createPage(context);

    // Step 1: 載入商品頁面
    console.log('📄 載入商品頁面...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await randomDelay(2000, 4000);

    // 模擬人類捲動行為
    await page.evaluate(() => {
      window.scrollTo({ top: Math.random() * 500 + 200, behavior: 'smooth' });
    });
    await randomDelay(500, 1000);

    // 檢查登入狀態
    const loggedIn = useAuth && await isLoggedIn(page);
    if (useAuth && !loggedIn) {
      console.log('⚠️ Session 已過期或未登入，使用商品頁模式');
      console.log('   提示：執行 --login 重新登入以獲取完整評論');
    } else if (loggedIn) {
      console.log('✅ 已登入 Amazon');
    }

    // Step 2: 解析商品資訊
    console.log('🔍 解析商品資訊...');
    const product = await parseProduct(page, url);
    const ratingSummary = await parseRatingSummary(page);

    console.log(`  標題: ${product.title.slice(0, 80)}...`);
    console.log(`  品牌: ${product.brand}`);
    console.log(`  評分: ${ratingSummary.average} (${ratingSummary.total_count} 則)`);

    // Step 3: 抓取評論
    console.log(`📝 開始抓取評論 (最多 ${maxReviews} 則)...`);
    const reviews: Review[] = [];
    const seenIds = new Set<string>();
    const language = locale.split('-')[0];

    if (loggedIn) {
      // 已登入：從評論專頁抓取
      await scrapeReviewsPage(page, asin, domain, maxReviews, reviews, seenIds, language);
    } else {
      // 未登入：從商品頁抓取
      await scrapeProductPageReviews(page, maxReviews, reviews, seenIds, language);
    }

    console.log(`\n📊 共抓取 ${reviews.length} 則評論`);

    // Step 4: 寫入 JSONL
    const platform = locale === 'ja-JP' ? 'amazon_jp' : 'amazon_us';
    const filepath = writeBatchedJsonl(
      product,
      ratingSummary,
      reviews,
      {
        platform,
        scraped_at: new Date().toISOString(),
        source_url: url,
        locale,
      },
      {
        batchSize,
        outputDir,
        platform,
      }
    );

    console.log(`\n✅ 完成！輸出：${filepath}`);
  } finally {
    await context.close();
  }
}

/**
 * 從評論專頁抓取評論（需要登入）
 * 使用點擊分頁按鈕的方式，模擬真實使用者行為
 */
async function scrapeReviewsPage(
  page: Page,
  asin: string,
  domain: string,
  maxReviews: number,
  reviews: Review[],
  seenIds: Set<string>,
  language: string
): Promise<void> {
  // 先導航到評論頁第一頁
  const reviewsUrl = buildReviewsUrl(asin, domain, 1);
  console.log(`  📄 載入評論頁...`);
  await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 檢查是否被導向登入頁
  if (await isSessionExpired(page)) {
    console.log('  ⚠️ Session 過期，請重新執行 --login');
    return;
  }

  let pageNumber = 1;
  let consecutiveEmptyPages = 0;

  while (reviews.length < maxReviews && consecutiveEmptyPages < 3) {
    console.log(`  📄 評論頁 ${pageNumber}...`);

    // 等待評論容器出現
    try {
      await page.waitForSelector('[data-hook="review"]', { timeout: 10000 });
    } catch {
      console.log('  ⏳ 等待評論元素超時...');
    }

    // 取得評論元素
    const reviewElements = await page.$$(SELECTORS.reviews.container);

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
          review.language = language;
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

    // 找下一頁按鈕並點擊
    const nextButton = await page.$(SELECTORS.reviews.pagination.nextPage);
    if (!nextButton) {
      console.log('  📄 已到最後一頁');
      break;
    }

    // 點擊下一頁（模擬真實使用者）
    await nextButton.scrollIntoViewIfNeeded();
    await randomDelay(500, 1000);
    await nextButton.click();
    await randomDelay(2000, 4000);

    // 等待頁面載入
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch {
      // 繼續
    }

    pageNumber++;
  }

  if (consecutiveEmptyPages >= 3) {
    console.log('  ⚠️ 連續 3 頁無新評論，停止抓取');
  }
}

/**
 * 從商品頁抓取評論（不需登入，但評論數有限）
 */
async function scrapeProductPageReviews(
  page: Page,
  maxReviews: number,
  reviews: Review[],
  seenIds: Set<string>,
  language: string
): Promise<void> {
  // 捲動載入更多評論
  console.log('  📜 捲動載入評論...');
  for (let scrollAttempt = 0; scrollAttempt < 10; scrollAttempt++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await randomDelay(500, 1000);
  }

  // 等待評論區載入
  try {
    await page.waitForSelector('[data-hook="review"]', { timeout: 10000 });
  } catch {
    console.log('  ⏳ 等待評論元素超時...');
  }

  // 從商品頁擷取評論
  const reviewElements = await page.$$(SELECTORS.reviews.container);
  console.log(`  🔍 找到 ${reviewElements.length} 則評論元素`);

  for (const element of reviewElements) {
    if (reviews.length >= maxReviews) break;

    const review = await parseReview(element);
    if (review && !seenIds.has(review.review_id)) {
      seenIds.add(review.review_id);
      review.language = language;
      reviews.push(review);
    }
  }

  console.log(`  ✅ 已抓取 ${reviews.length} 則評論`);

  if (reviews.length < maxReviews) {
    console.log(`  ⚠️ 商品頁評論數有限（約 8-15 則）`);
    console.log(`     提示：執行 --login 登入後可抓取完整評論`);
  }
}

main().catch((err) => {
  console.error('❌ 爬蟲執行失敗:', err);
  process.exit(1);
});
