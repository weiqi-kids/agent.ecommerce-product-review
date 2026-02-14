/**
 * Walmart 頁面解析器
 * 從 Walmart 商品頁和評論頁提取資料
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

  // SKU / Product ID
  const sku = await page.$eval(
    SELECTORS.product.sku,
    (el) => (el as HTMLInputElement).value || el.getAttribute('content') || el.textContent?.trim() || ''
  ).catch(() => '');

  // UPC
  const upc = await page.$eval(
    SELECTORS.product.upc,
    (el) => el.textContent?.trim() || ''
  ).catch(() => '');

  // 商品主圖
  const imageUrl = await page.$eval(
    SELECTORS.product.image,
    (el) => (el as HTMLImageElement).src || ''
  ).catch(() => '');

  return {
    asin: undefined, // Walmart 不使用 ASIN
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
    bullet_points: [], // Walmart 通常沒有 bullet points
    seller: {
      store_id: sku || 'walmart',
      store_name: 'Walmart',
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
    (el) => el.getAttribute('aria-label') || el.textContent?.trim() || ''
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

  // 評分分佈（嘗試解析）
  const distribution: Record<string, number> = {
    '5': 0,
    '4': 0,
    '3': 0,
    '2': 0,
    '1': 0,
  };

  try {
    const bars = await page.$$(SELECTORS.ratingDistribution.histogram);
    for (let i = 0; i < Math.min(bars.length, 5); i++) {
      const stars = 5 - i;
      const widthStyle = await bars[i].getAttribute('style');
      const widthMatch = widthStyle?.match(/width:\s*([\d.]+)%/);
      if (widthMatch) {
        const percentage = parseFloat(widthMatch[1]);
        distribution[String(stars)] = Math.round((percentage / 100) * totalCount);
      }
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
      // 使用內容 hash 作為 fallback
      const bodyText = await element.$eval(
        SELECTORS.reviews.body,
        (el) => el.textContent?.trim().slice(0, 50) || ''
      ).catch(() => '');
      reviewId = `wmt-${hashString(bodyText)}`;
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
      (el) => el.textContent?.trim() || ''
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
  // Walmart 日期格式可能是：
  // - "Jan 15, 2026"
  // - "1/15/2026"
  // - "January 15, 2026"
  // - "15 days ago"

  if (!dateText) {
    return new Date().toISOString().slice(0, 10);
  }

  // 相對日期處理
  const daysAgoMatch = dateText.match(/(\d+)\s*days?\s*ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  // 嘗試解析標準日期
  try {
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch {
    // 繼續嘗試其他格式
  }

  // 預設為今天
  return new Date().toISOString().slice(0, 10);
}

/**
 * 簡單的字串 hash 函數
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
