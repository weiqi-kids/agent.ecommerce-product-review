/**
 * Best Buy CSS/XPath 選擇器定義
 */

export const SELECTORS = {
  // === 商品頁面 ===
  product: {
    title: '.sku-title h1, .heading-5.v-fw-regular',
    brand: '[data-track="product-brand"], .product-data-value.brand',
    price: '.priceView-hero-price span[aria-hidden="true"], .priceView-customer-price span',
    rating: '.c-ratings-reviews .c-ratings-reviews-v4 .ugc-c-review-average',
    ratingCount: '.c-ratings-reviews .c-total-reviews, .ugc-c-review-count',
    description: '.product-description, [data-track="product-description"]',
    breadcrumb: '.breadcrumb a, .shop-breadcrumb a',
    sku: '[data-sku-id], .sku-value, .product-data-value.sku',
    upc: '[data-upc], .product-data-value.upc',
    model: '.product-data-value.model',
    // 商品主圖
    image: '.primary-image img, .shop-media-gallery img, [data-testid="product-image"] img',
  },

  // === 評論列表 ===
  reviews: {
    container: '.ugc-review-body, [data-track="review-content"], .review-item',
    containerFallbacks: [
      '.ugc-c-review-list .ugc-c-review',
      '.review-content',
      '[itemprop="review"]',
    ],
    title: '.ugc-c-review-title, .review-title, [itemprop="name"]',
    body: '.ugc-c-review-body, .review-text, [itemprop="reviewBody"]',
    rating: '.ugc-c-review-rating [aria-label], .c-review-average, [itemprop="ratingValue"]',
    date: '.submission-date, .review-date, [itemprop="datePublished"]',
    verifiedPurchase: '.verified-purchaser, [data-track="verified-purchaser"]',
    helpfulVotes: '.ugc-c-review-helpful-count, .helpful-count',
    reviewId: '[data-review-id], [data-track="review-id"]',
    authorName: '.ugc-c-review-author, .review-author',
    pagination: {
      nextPage: '.ugc-c-pagination-next, .pagination-next, [data-track="pagination-next"]',
      pageNumbers: '.ugc-c-pagination-page, .pagination-page',
    },
    totalCount: '.ugc-c-review-count, .review-summary-total',
  },

  // === 評分分佈 ===
  ratingDistribution: {
    histogram: '.c-ratings-histogram .c-ratings-histogram-row',
    starLabel: '.c-ratings-histogram-label',
    count: '.c-ratings-histogram-count',
  },

  // === 搜尋結果 ===
  search: {
    results: '.sku-item, [data-sku-id]',
    productLink: '.sku-title a, .sku-header a',
    productSku: '[data-sku-id]',
  },
} as const;

/**
 * 從 Best Buy URL 提取 SKU
 * Best Buy 使用 SKU ID 作為產品識別碼
 */
export function extractSkuFromUrl(url: string): string | null {
  // 匹配 /site/product-name/1234567.p 或 skuId=1234567
  const patterns = [
    /\/(\d{7})\.p/,
    /skuId=(\d{7})/,
    /\/product\/(\d{7})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 根據 SKU 構建評論頁 URL
 */
export function buildReviewsUrl(sku: string, pageNumber: number = 1): string {
  return `https://www.bestbuy.com/site/reviews/${sku}?page=${pageNumber}&sort=MOST_RECENT`;
}

/**
 * 根據 UPC 搜尋產品
 */
export function buildSearchByUpcUrl(upc: string): string {
  return `https://www.bestbuy.com/site/searchpage.jsp?st=${upc}`;
}

/**
 * 根據產品名稱搜尋
 */
export function buildSearchByNameUrl(name: string): string {
  const encoded = encodeURIComponent(name);
  return `https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}`;
}

/**
 * 構建產品頁 URL
 */
export function buildProductUrl(sku: string): string {
  return `https://www.bestbuy.com/site/${sku}.p`;
}
