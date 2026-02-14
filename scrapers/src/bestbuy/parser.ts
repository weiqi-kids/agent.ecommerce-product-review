/**
 * Best Buy 頁面解析器
 */

import type { Page, ElementHandle } from 'playwright';
import type { Product, RatingSummary, Review } from '../common/types.js';
import { SELECTORS } from './selectors.js';

/**
 * 解析商品資訊
 */
export async function parseProduct(page: Page, sourceUrl: string): Promise<Product> {
  // 標題
  const title = await page.$eval(
    SELECTORS.product.title,
    (el) => el.textContent?.trim() || ''
  ).catch(() => 'Unknown Product');

  // 品牌
  const brand = await page.$eval(
    SELECTORS.product.brand,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');

  // 價格
  const priceText = await page.$eval(
    SELECTORS.product.price,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');
  const priceMatch = priceText.match(/[\d,.]+/);
  const amount = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;

  // 分類麵包屑
  const breadcrumbs = await page.$$eval(
    SELECTORS.product.breadcrumb,
    (els) => els.map((el) => el.textContent?.trim() || '').filter(Boolean)
  ).catch(() => []);

  // 描述
  const description = await page.$eval(
    SELECTORS.product.description,
    (el) => el.textContent?.trim().slice(0, 1000) || ''
  ).catch(() => '');

  // SKU
  const sku = await page.$eval(
    SELECTORS.product.sku,
    (el) => el.getAttribute('data-sku-id') || el.textContent?.trim() || ''
  ).catch(() => '');

  // UPC
  const upc = await page.$eval(
    SELECTORS.product.upc,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');

  // Model
  const model = await page.$eval(
    SELECTORS.product.model,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');

  // 商品主圖
  const imageUrl = await page.$eval(
    SELECTORS.product.image,
    (el) => (el as HTMLImageElement).src || ''
  ).catch(() => '');

  return {
    asin: undefined,
    sku: sku || undefined,
    upc: upc || undefined,
    title,
    brand,
    image_url: imageUrl || undefined,
    price: {
      amount,
      currency: 'USD',
    },
    category_breadcrumb: breadcrumbs,
    description,
    bullet_points: model ? [`Model: ${model}`] : [],
    seller: {
      store_id: sku || 'bestbuy',
      store_name: 'Best Buy',
      is_official: true,
    },
  };
}

/**
 * 解析評分摘要
 */
export async function parseRatingSummary(page: Page): Promise<RatingSummary> {
  // 平均評分
  const ratingText = await page.$eval(
    SELECTORS.product.rating,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');
  const ratingMatch = ratingText.match(/[\d.]+/);
  const average = ratingMatch ? parseFloat(ratingMatch[0]) : 0;

  // 總評論數
  const countText = await page.$eval(
    SELECTORS.product.ratingCount,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');
  const countMatch = countText.match(/[\d,]+/);
  const totalCount = countMatch ? parseInt(countMatch[0].replace(',', ''), 10) : 0;

  // 評分分佈
  const distribution: Record<string, number> = {
    '5': 0,
    '4': 0,
    '3': 0,
    '2': 0,
    '1': 0,
  };

  try {
    const rows = await page.$$(SELECTORS.ratingDistribution.histogram);
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const stars = 5 - i;
      const countText = await rows[i].$eval(
        SELECTORS.ratingDistribution.count,
        (el) => el.textContent?.trim() || ''
      ).catch(() => '0');
      const count = parseInt(countText.replace(/[^\d]/g, ''), 10) || 0;
      distribution[String(stars)] = count;
    }
  } catch {
    // 分佈資訊可選
  }

  return {
    average,
    total_count: totalCount,
    distribution,
  };
}

/**
 * 解析單則評論
 */
export async function parseReview(element: ElementHandle): Promise<Review | null> {
  try {
    // Review ID
    let reviewId = await element.getAttribute('data-review-id');
    if (!reviewId) {
      reviewId = await element.getAttribute('id');
    }
    if (!reviewId) {
      const bodyText = await element.$eval(
        SELECTORS.reviews.body,
        (el) => el.textContent?.trim().slice(0, 50) || ''
      ).catch(() => '');
      reviewId = `bb-${hashString(bodyText)}`;
    }

    // 評分
    const ratingText = await element.$eval(
      SELECTORS.reviews.rating,
      (el) => el.getAttribute('aria-label') || el.textContent?.trim() || ''
    ).catch(() => '');
    const ratingMatch = ratingText.match(/[\d.]+/);
    const rating = ratingMatch ? parseFloat(ratingMatch[0]) : 0;

    // 標題
    const title = await element.$eval(
      SELECTORS.reviews.title,
      (el) => el.textContent?.trim() || ''
    ).catch(() => '');

    // 內文
    const body = await element.$eval(
      SELECTORS.reviews.body,
      (el) => el.textContent?.trim() || ''
    ).catch(() => '');

    // 日期
    const dateText = await element.$eval(
      SELECTORS.reviews.date,
      (el) => el.textContent?.trim() || el.getAttribute('content') || ''
    ).catch(() => '');
    const date = parseDate(dateText);

    // 驗證購買
    const verifiedPurchase = await element.$(SELECTORS.reviews.verifiedPurchase) !== null;

    // 有幫助票數
    const helpfulText = await element.$eval(
      SELECTORS.reviews.helpfulVotes,
      (el) => el.textContent?.trim() || ''
    ).catch(() => '');
    const helpfulMatch = helpfulText.match(/(\d+)/);
    const helpfulVotes = helpfulMatch ? parseInt(helpfulMatch[1], 10) : 0;

    // 過濾無效評論
    if (!body || body.length < 10) {
      return null;
    }

    return {
      review_id: reviewId,
      rating,
      title: title || `${rating} out of 5 stars`,
      body,
      date,
      verified_purchase: verifiedPurchase,
      helpful_votes: helpfulVotes,
      language: 'en',
    };
  } catch (err) {
    console.error('  ⚠️ 解析評論失敗:', err);
    return null;
  }
}

/**
 * 解析日期字串為 YYYY-MM-DD 格式
 */
function parseDate(dateText: string): string {
  if (!dateText) {
    return new Date().toISOString().slice(0, 10);
  }

  // Best Buy 可能使用 ISO 格式或 "Posted on Jan 15, 2026"
  const postedMatch = dateText.match(/Posted\s+(?:on\s+)?(.+)/i);
  const textToParse = postedMatch ? postedMatch[1] : dateText;

  // 相對日期
  const daysAgoMatch = textToParse.match(/(\d+)\s*days?\s*ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  // 嘗試解析標準日期
  try {
    const parsed = new Date(textToParse);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch {
    // 繼續
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * 簡單的字串 hash
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
