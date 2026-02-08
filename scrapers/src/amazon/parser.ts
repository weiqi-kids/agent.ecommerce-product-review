/**
 * Amazon 商品/評論解析器
 */

import type { Page } from 'playwright';
import type { Product, RatingSummary, Review, ProductSeller } from '../common/types.js';
import { SELECTORS, TITLE_FALLBACKS, extractAsinFromUrl } from './selectors.js';

/**
 * 解析商品資訊
 */
export async function parseProduct(page: Page, sourceUrl: string): Promise<Product> {
  let title = await safeText(page, SELECTORS.product.title);

  // 主選擇器失敗時，嘗試備用選擇器
  if (!title) {
    for (const fallback of TITLE_FALLBACKS) {
      title = await safeText(page, fallback);
      if (title) break;
    }
  }
  title = title || 'Unknown Product';

  const brand = await parseBrand(page);
  const price = await parsePrice(page);
  const description = await safeText(page, SELECTORS.product.description) || '';
  const bulletPoints = await parseBulletPoints(page);
  const breadcrumb = await parseBreadcrumb(page);
  const asin = extractAsinFromUrl(sourceUrl) || await parseAsin(page) || '';
  const seller = await parseSeller(page);

  return {
    asin,
    upc: '',  // UPC 通常不在頁面上顯示
    title: title.trim(),
    brand,
    price: {
      amount: price.amount,
      currency: price.currency,
    },
    category_breadcrumb: breadcrumb,
    description: description.trim(),
    bullet_points: bulletPoints,
    seller,
  };
}

/**
 * 解析評分摘要
 */
export async function parseRatingSummary(page: Page): Promise<RatingSummary> {
  // 平均評分
  const ratingText = await safeText(page, SELECTORS.product.rating);
  const average = ratingText ? parseFloat(ratingText.replace(/[^0-9.]/g, '')) || 0 : 0;

  // 總評論數
  const countText = await safeText(page, SELECTORS.product.ratingCount);
  const totalCount = countText ? parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0 : 0;

  // 評分分佈
  const distribution: Record<string, number> = {};
  try {
    const rows = await page.$$(SELECTORS.ratingDistribution.histogram);
    for (const row of rows) {
      const label = await row.$eval('.a-text-right a', el => el.textContent?.trim() || '');
      const pctText = await row.$eval('td:nth-child(3) a', el => el.textContent?.trim() || '').catch(() => '0%');
      const star = label.match(/(\d)/)?.[1];
      if (star) {
        const pct = parseInt(pctText.replace('%', ''), 10) || 0;
        distribution[star] = Math.round(totalCount * pct / 100);
      }
    }
  } catch (err) {
    console.error(`⚠️ [parseRatingSummary] 解析評分分佈失敗:`, err instanceof Error ? err.message : err);
  }

  return { average, total_count: totalCount, distribution };
}

/**
 * 解析單則評論
 */
export async function parseReview(element: any): Promise<Review | null> {
  try {
    // 嘗試多種方式取得 review_id
    let reviewId = await element.getAttribute('id');

    // 備用：從 data-review-id 屬性取得
    if (!reviewId) {
      reviewId = await element.getAttribute('data-review-id');
    }

    // 備用：從子元素的 id 取得
    if (!reviewId) {
      const reviewEl = await element.$('[id^="customer_review-"], [id^="review-"]');
      if (reviewEl) {
        reviewId = await reviewEl.getAttribute('id');
      }
    }

    // Debug: 輸出 reviewId 狀態
    // console.log(`  [DEBUG] reviewId from attributes: ${reviewId}`);

    // 最後備用：使用內容+時間戳雜湊
    if (!reviewId) {
      // 先取得內文用於雜湊
      const bodyEl = await element.$(SELECTORS.reviews.body);
      const bodyText = bodyEl ? (await bodyEl.textContent())?.trim() || '' : '';
      // 取得日期用於區分
      const dateEl = await element.$(SELECTORS.reviews.date);
      const dateText = dateEl ? (await dateEl.textContent())?.trim() || '' : '';
      // 合併內文+日期做雜湊
      const hashSource = `${bodyText.slice(0, 100)}|${dateText}`;
      let hashCode = 0;
      for (const c of hashSource) {
        hashCode = ((hashCode << 5) - hashCode + c.charCodeAt(0)) | 0;
      }
      reviewId = `amz-${Math.abs(hashCode).toString(36)}`;
    }

    // 評分
    const ratingEl = await element.$(SELECTORS.reviews.rating);
    const ratingText = ratingEl ? await ratingEl.textContent() : '';
    const rating = ratingText ? parseFloat(ratingText.replace(/[^0-9.]/g, '')) || 0 : 0;

    // 標題
    const titleEl = await element.$(SELECTORS.reviews.title);
    const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

    // 內文
    const bodyEl = await element.$(SELECTORS.reviews.body);
    const body = bodyEl ? (await bodyEl.textContent())?.trim() || '' : '';

    // 日期
    const dateEl = await element.$(SELECTORS.reviews.date);
    const dateText = dateEl ? (await dateEl.textContent())?.trim() || '' : '';
    const date = parseDateString(dateText);

    // 已驗證購買
    const verifiedEl = await element.$(SELECTORS.reviews.verifiedPurchase);
    const verifiedPurchase = !!verifiedEl;

    // 有幫助票數
    const helpfulEl = await element.$(SELECTORS.reviews.helpfulVotes);
    const helpfulText = helpfulEl ? (await helpfulEl.textContent())?.trim() || '' : '';
    const helpfulVotes = parseHelpfulVotes(helpfulText);

    return {
      review_id: reviewId,
      rating,
      title,
      body,
      date,
      verified_purchase: verifiedPurchase,
      helpful_votes: helpfulVotes,
      language: 'en',  // 會由 scraper 根據 locale 覆寫
    };
  } catch (err) {
    console.error(`⚠️ [parseReview] 解析評論失敗:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// === 內部工具函式 ===

async function safeText(page: Page, selector: string): Promise<string | null> {
  try {
    const el = await page.$(selector);
    return el ? (await el.textContent())?.trim() || null : null;
  } catch {
    return null;
  }
}

async function parseBrand(page: Page): Promise<string> {
  const text = await safeText(page, SELECTORS.product.brand);
  if (!text) return '';
  // "Visit the Apple Store" → "Apple"
  // "Brand: Apple" → "Apple"
  return text
    .replace(/^Visit the\s+/i, '')
    .replace(/\s+Store$/i, '')
    .replace(/^Brand:\s*/i, '')
    .trim();
}

async function parsePrice(page: Page): Promise<{ amount: number; currency: string }> {
  const text = await safeText(page, SELECTORS.product.price);
  if (!text) return { amount: 0, currency: 'USD' };

  const currencyMap: Record<string, string> = {
    '$': 'USD', '¥': 'JPY', '£': 'GBP', '€': 'EUR',
  };

  const currencySymbol = text.match(/[$¥£€]/)?.[0] || '$';
  const amount = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;

  return {
    amount,
    currency: currencyMap[currencySymbol] || 'USD',
  };
}

async function parseBulletPoints(page: Page): Promise<string[]> {
  try {
    const items = await page.$$(SELECTORS.product.bulletPoints);
    const points: string[] = [];
    for (const item of items) {
      const text = (await item.textContent())?.trim();
      if (text && text.length > 0) points.push(text);
    }
    return points;
  } catch {
    return [];
  }
}

async function parseBreadcrumb(page: Page): Promise<string[]> {
  try {
    const links = await page.$$(SELECTORS.product.breadcrumb);
    const crumbs: string[] = [];
    for (const link of links) {
      const text = (await link.textContent())?.trim();
      if (text && text.length > 0) crumbs.push(text);
    }
    return crumbs;
  } catch {
    return [];
  }
}

async function parseAsin(page: Page): Promise<string | null> {
  try {
    // 嘗試從 input 元素取得
    const input = await page.$('input[name="ASIN"]');
    if (input) {
      return await input.getAttribute('value');
    }
    // 嘗試從 data-asin 屬性取得
    const el = await page.$('[data-asin]');
    if (el) {
      return await el.getAttribute('data-asin');
    }
    return null;
  } catch {
    return null;
  }
}

async function parseSeller(page: Page): Promise<ProductSeller> {
  const sellerText = await safeText(page, SELECTORS.product.sellerName);
  if (sellerText && !sellerText.toLowerCase().includes('amazon')) {
    return {
      store_id: sellerText.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50),
      store_name: sellerText.trim(),
      is_official: false,
    };
  }
  return {
    store_id: 'amzn-direct',
    store_name: 'Amazon.com',
    is_official: true,
  };
}

function parseDateString(dateText: string): string {
  // "Reviewed in the United States on January 15, 2026"
  const match = dateText.match(/on\s+(.+)$/i);
  if (match) {
    try {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch { /* fall through */ }
  }

  // 日文格式: "2026年1月15日"
  const jpMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jpMatch) {
    return `${jpMatch[1]}-${jpMatch[2].padStart(2, '0')}-${jpMatch[3].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

function parseHelpfulVotes(text: string): number {
  if (!text) return 0;
  // "42 people found this helpful"
  const match = text.match(/(\d+)/);
  // "One person found this helpful"
  if (text.toLowerCase().includes('one person')) return 1;
  return match ? parseInt(match[1], 10) : 0;
}
