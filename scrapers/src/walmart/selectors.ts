/**
 * Walmart CSS/XPath 選擇器定義
 * 集中管理所有選擇器，方便維護
 */

export const SELECTORS = {
  // === 商品頁面 ===
  product: {
    title: 'h1[itemprop="name"], h1.prod-ProductTitle',
    brand: '[data-testid="brand-name"], .prod-brandName',
    price: '[itemprop="price"], [data-testid="price-wrap"]',
    rating: '[data-testid="reviews-rating"], .stars-container [aria-label]',
    ratingCount: '[data-testid="reviews-count"], .ReviewsHeader-reviewCount',
    description: '[data-testid="product-description"], .dangerous-html',
    breadcrumb: '[data-testid="breadcrumb"] a, .breadcrumb-link',
    sku: '[data-testid="product-id"], input[name="productId"]',
    upc: '[data-testid="upc-value"]',
    // 商品主圖
    image: '[data-testid="hero-image"] img, .prod-hero-image img, [data-testid="media-thumbnail"] img',
  },

  // === 評論列表 ===
  reviews: {
    container: '[data-testid="review-card"], .customer-review-card',
    containerFallbacks: [
      '.customer-reviews .review-card',
      '[data-automation-id="customer-review"]',
      '.reviews-list .review',
    ],
    title: '[data-testid="review-title"], .review-title',
    body: '[data-testid="review-text"], .review-text',
    rating: '[data-testid="review-rating"], .review-stars [aria-label]',
    date: '[data-testid="review-date"], .review-date',
    verifiedPurchase: '[data-testid="verified-purchase-badge"]',
    helpfulVotes: '[data-testid="helpful-count"], .helpful-count',
    reviewId: '[data-review-id], [data-testid="review-card"]',
    authorName: '[data-testid="reviewer-name"], .reviewer-name',
    pagination: {
      nextPage: '[data-testid="next-page"], .paginator-next',
      pageNumbers: '[data-testid="page-number"], .paginator-page',
    },
    // 評論數量
    totalCount: '[data-testid="reviews-header-count"], .reviews-header .count',
  },

  // === 評分分佈 ===
  ratingDistribution: {
    histogram: '[data-testid="rating-histogram"] .bar',
    starRow: '.rating-stars-row',
    percentage: '.rating-percentage',
  },

  // === 搜尋結果 ===
  search: {
    results: '[data-testid="search-result-item"], .search-result-gridview-item',
    productLink: '[data-testid="product-title-link"], .product-title-link',
    productId: '[data-item-id], [data-product-id]',
  },
} as const;

/**
 * 從 Walmart URL 提取商品 ID
 * Walmart 使用的 ID 格式：數字或 slug-數字
 */
export function extractProductIdFromUrl(url: string): string | null {
  // 匹配 /ip/PRODUCT-NAME/123456789 或 /ip/123456789
  const patterns = [
    /\/ip\/[^\/]+\/(\d+)/,
    /\/ip\/(\d+)/,
    /\/product\/(\d+)/,
    /itemId=(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 根據商品 ID 構建評論頁 URL
 */
export function buildReviewsUrl(productId: string, pageNumber: number = 1): string {
  return `https://www.walmart.com/reviews/product/${productId}?page=${pageNumber}&sort=submission-desc`;
}

/**
 * 根據 UPC 搜尋產品
 */
export function buildSearchByUpcUrl(upc: string): string {
  return `https://www.walmart.com/search?q=${upc}`;
}

/**
 * 根據產品名稱搜尋
 */
export function buildSearchByNameUrl(name: string): string {
  const encoded = encodeURIComponent(name);
  return `https://www.walmart.com/search?q=${encoded}`;
}
