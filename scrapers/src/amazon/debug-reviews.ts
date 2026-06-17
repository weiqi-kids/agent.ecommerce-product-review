/**
 * Debug：檢視 Amazon 評論頁實際 DOM 結構，診斷 body/title selector 失效
 */
import { launchPersistentContext, getDefaultProfileDir, createPage } from '../common/browser.js';
import { buildReviewsUrl } from './selectors.js';

async function main() {
  const asin = process.argv[2] || 'B0BL7316GD';
  const profileDir = getDefaultProfileDir('amazon');
  const context = await launchPersistentContext({ userDataDir: profileDir, headless: true, locale: 'en-US', timeout: 30000 });
  const page = await createPage(context);
  const mode = process.argv[3] || 'reviews';
  const url = mode === 'dp' ? `https://www.amazon.com/dp/${asin}` : buildReviewsUrl(asin, 'www.amazon.com', 1);
  console.log('載入:', url, '(mode=' + mode + ')');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  // 模擬 scraper：捲動觸發 lazy-load
  for (let y = 0; y < 8000; y += 1500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);

  // 是否被導向登入/驗證頁
  const pageTitle = await page.title();
  console.log('頁面標題:', pageTitle);
  console.log('目前 URL:', page.url());

  const reviewCount = await page.locator('[data-hook="review"]').count();
  console.log('[data-hook="review"] 數量:', reviewCount);

  // 嘗試各種候選 selector 計數
  const candidates = [
    '[data-hook="review-body"]',
    '[data-hook="reviewTitle"]',
    '[data-hook="review-text-content"]',
    '[data-hook="review-text-content"] span',
    '[data-hook="reviewText"]',
    '[data-hook="review-text"]',
    'span[data-hook="review-text"]',
    '[class*="review-text"]',
    '[class*="_review-text_"]',
    '[class*="single-review"]',
  ];
  for (const c of candidates) {
    const n = await page.locator(c).count();
    console.log(`  count ${c} = ${n}`);
  }

  // 傾印第一個 review 的 outerHTML（截斷）
  const first = page.locator('[data-hook="review"]').first();
  if (await first.count()) {
    const html = await first.evaluate((el: any) => el.outerHTML);
    console.log('\n=== 第一個 review outerHTML（2200-5200 字，body 區段）===');
    console.log(html.slice(2200, 5200));
    // 列出所有 data-hook 值
    const hooks = await first.evaluate((el: any) => Array.from(el.querySelectorAll('[data-hook]')).map((e: any) => e.getAttribute('data-hook')));
    console.log('\n=== 此 review 內所有 data-hook ===');
    console.log([...new Set(hooks)].join(', '));
  }

  await context.close();
}
main().catch(e => { console.error(e); process.exit(1); });
