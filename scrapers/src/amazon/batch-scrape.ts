/**
 * Amazon 批次評論抓取
 *
 * 用法：
 *   npx tsx src/amazon/batch-scrape.ts \
 *     --input /tmp/all-products.txt \
 *     --output ./output \
 *     --max-reviews 50 \
 *     --batch-size 10 \
 *     --start 0
 */

import { launchPersistentContext, getDefaultProfileDir, createPage, randomDelay } from '../common/browser.js';
import { writeBatchedJsonl, parseCliArgs } from '../common/output.js';
import { parseProduct, parseRatingSummary, parseReview } from './parser.js';
import { SELECTORS, extractAsinFromUrl, buildReviewsUrl } from './selectors.js';
import { isLoggedIn, isSessionExpired } from './auth.js';
import type { Review } from '../common/types.js';
import type { BrowserContext, Page } from 'playwright';
import { readFileSync, appendFileSync, existsSync } from 'fs';

interface ScrapeResult {
  asin: string;
  status: 'success' | 'failed' | 'skipped';
  reviewCount: number;
  error?: string;
}

async function main() {
  const args = parseCliArgs();

  const inputFile = args['input'] || '/tmp/all-products.txt';
  const outputDir = args['output'] || './output';
  const maxReviews = parseInt(args['max-reviews'] || '50', 10);
  const batchSize = parseInt(args['batch-size'] || '10', 10);
  const startIndex = parseInt(args['start'] || '0', 10);
  const endIndex = args['end'] ? parseInt(args['end'], 10) : undefined;
  const headless = args['headless'] !== 'false';
  const logFile = args['log'] || '/tmp/scrape-progress.log';

  // 讀取商品清單
  if (!existsSync(inputFile)) {
    console.error(`❌ 找不到輸入檔案: ${inputFile}`);
    process.exit(1);
  }

  const lines = readFileSync(inputFile, 'utf-8').trim().split('\n');
  const asins = lines.map(line => {
    const match = line.match(/\/dp\/([A-Z0-9]{10})/);
    return match ? match[1] : line.trim();
  }).filter(asin => asin.length === 10);

  const totalProducts = endIndex ? Math.min(endIndex, asins.length) : asins.length;
  const productsToScrape = asins.slice(startIndex, totalProducts);

  console.log(`📦 批次抓取: ${productsToScrape.length} 個商品 (${startIndex} - ${totalProducts - 1})`);
  console.log(`   每個商品最多 ${maxReviews} 則評論`);
  console.log(`   輸出目錄: ${outputDir}`);
  console.log(`   進度日誌: ${logFile}`);

  // 初始化瀏覽器
  const profileDir = getDefaultProfileDir('amazon');
  let context: BrowserContext;

  try {
    context = await launchPersistentContext({
      userDataDir: profileDir,
      headless,
      locale: 'en-US',
      timeout: 60000,
    });
    console.log('🔐 使用已保存的登入狀態');
  } catch {
    console.error('❌ 無法啟動瀏覽器，請確認已執行登入');
    process.exit(1);
  }

  const results: ScrapeResult[] = [];
  let successCount = 0;
  let failCount = 0;

  try {
    const page = await createPage(context);

    // 檢查登入狀態
    await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      console.error('❌ 未登入 Amazon，請先執行 --login');
      process.exit(1);
    }
    console.log('✅ 已登入 Amazon\n');

    // 開始抓取
    for (let i = 0; i < productsToScrape.length; i++) {
      const asin = productsToScrape[i];
      const globalIndex = startIndex + i;
      const progress = `[${globalIndex + 1}/${totalProducts}]`;

      console.log(`${progress} 抓取 ${asin}...`);

      try {
        const result = await scrapeProduct(page, asin, outputDir, maxReviews);
        results.push(result);

        if (result.status === 'success') {
          successCount++;
          console.log(`  ✅ ${result.reviewCount} 則評論`);
        } else if (result.status === 'skipped') {
          console.log(`  ⏭️ 已存在，跳過`);
        } else {
          failCount++;
          console.log(`  ❌ ${result.error}`);
        }

        // 記錄進度
        const logEntry = `${new Date().toISOString()} | ${asin} | ${result.status} | ${result.reviewCount} | ${result.error || ''}\n`;
        appendFileSync(logFile, logEntry);

        // 批次間延遲
        if ((i + 1) % batchSize === 0 && i < productsToScrape.length - 1) {
          console.log(`\n⏸️ 批次完成，休息 30 秒...\n`);
          await randomDelay(25000, 35000);
        } else {
          await randomDelay(3000, 6000);
        }

      } catch (err) {
        failCount++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`  ❌ ${errorMsg}`);
        results.push({ asin, status: 'failed', reviewCount: 0, error: errorMsg });

        // 發生錯誤時多等一下
        await randomDelay(5000, 10000);
      }
    }

  } finally {
    await context.close();
  }

  // 輸出統計
  console.log('\n' + '='.repeat(50));
  console.log(`📊 抓取完成`);
  console.log(`   成功: ${successCount}`);
  console.log(`   失敗: ${failCount}`);
  console.log(`   總計: ${results.length}`);
  console.log(`   進度日誌: ${logFile}`);
}

async function scrapeProduct(
  page: Page,
  asin: string,
  outputDir: string,
  maxReviews: number
): Promise<ScrapeResult> {
  const url = `https://www.amazon.com/dp/${asin}`;

  // 載入商品頁面
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  await randomDelay(2000, 3000);

  // 模擬人類行為
  await page.evaluate(() => {
    window.scrollTo({ top: Math.random() * 500 + 200, behavior: 'smooth' });
  });
  await randomDelay(500, 1000);

  // 解析商品資訊
  const product = await parseProduct(page, url);
  const ratingSummary = await parseRatingSummary(page);

  // 抓取評論
  const reviews: Review[] = [];
  const seenIds = new Set<string>();

  // 導航到評論頁
  const reviewsUrl = buildReviewsUrl(asin, 'www.amazon.com', 1);
  await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 檢查是否被導向登入頁
  if (await isSessionExpired(page)) {
    return { asin, status: 'failed', reviewCount: 0, error: 'Session expired' };
  }

  let pageNumber = 1;
  let consecutiveEmptyPages = 0;

  while (reviews.length < maxReviews && consecutiveEmptyPages < 3) {
    // 等待評論容器
    try {
      await page.waitForSelector('[data-hook="review"]', { timeout: 10000 });
    } catch {
      break;
    }

    // 取得評論元素
    const reviewElements = await page.$$(SELECTORS.reviews.container);
    if (reviewElements.length === 0) break;

    let newCount = 0;
    for (const element of reviewElements) {
      if (reviews.length >= maxReviews) break;

      const review = await parseReview(element);
      if (review && !seenIds.has(review.review_id)) {
        seenIds.add(review.review_id);
        review.language = 'en';
        reviews.push(review);
        newCount++;
      }
    }

    if (newCount === 0) {
      consecutiveEmptyPages++;
    } else {
      consecutiveEmptyPages = 0;
    }

    // 點擊下一頁
    const nextButton = await page.$(SELECTORS.reviews.pagination.nextPage);
    if (!nextButton) break;

    await nextButton.scrollIntoViewIfNeeded();
    await randomDelay(500, 1000);
    await nextButton.click();
    await randomDelay(2000, 4000);

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch {
      // 繼續
    }

    pageNumber++;
  }

  // 寫入 JSONL
  if (reviews.length > 0) {
    writeBatchedJsonl(
      product,
      ratingSummary,
      reviews,
      {
        platform: 'amazon_us',
        scraped_at: new Date().toISOString(),
        source_url: url,
        locale: 'en-US',
      },
      {
        batchSize: 50,
        outputDir,
        platform: 'amazon_us',
      }
    );
  }

  return { asin, status: 'success', reviewCount: reviews.length };
}

main().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
