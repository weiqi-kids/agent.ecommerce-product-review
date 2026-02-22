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
 * 從 Best Buy URL 提取產品 ID
 * Best Buy 使用多種格式：
 *   - 舊格式：/site/product-name/1234567.p（7 位數 SKU）
 *   - 新格式：/product/product-name/ABC123XYZ（字母數字 ID）
 *   - 新格式變體：/product/product-name/ABC123XYZ/sku/12345678
 *   - 新格式變體：/product/product-name/ABC123XYZ#tabbed-customerreviews
 */
export function extractSkuFromUrl(url: string): string | null {
  // 移除 URL 片段（#...）和查詢參數
  const cleanUrl = url.split('#')[0].split('?')[0];

  // 按優先級嘗試各種格式
  const patterns = [
    // 新格式：/product/{name}/{id} - 字母數字混合 ID
    /\/product\/[^/]+\/([A-Z0-9]{8,12})(?:\/|$)/i,
    // 舊格式：/site/{name}/{sku}.p - 7 位數字
    /\/(\d{7})\.p/,
    // URL 參數：skuId=
    /skuId=(\d{5,8})/,
    // 新格式變體：直接 /product/{id}
    /\/product\/([A-Z0-9]{8,12})(?:\/|$)/i,
    // 新格式：/site/{category}/{name}/{id}.p
    /\/site\/[^/]+\/[^/]+\/(\d{5,8})\.p/,
    // 備用：任何看起來像 SKU 的路徑段（5-8 位數字或 8-12 位字母數字）
    /\/(\d{5,8})(?:\.p)?(?:\/|$)/,
    /\/([A-Z0-9]{8,12})(?:\/|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
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
 * 根據 ID 格式選擇：7 位數字用舊格式，其他用新格式
 */
export function buildProductUrl(productId: string): string {
  const isOldFormat = /^\d{7}$/.test(productId);
  return isOldFormat
    ? `https://www.bestbuy.com/site/${productId}.p`
    : `https://www.bestbuy.com/product/${productId}`;
}

/**
 * Discovery 專用選擇器（排名頁面）
 * 2026 年更新：Best Buy 使用 .product-list-item 作為主要商品容器
 */
export const DISCOVERY_SELECTORS = {
  // 商品列表選擇器（按優先級排序，.product-list-item 為 2026 新格式）
  productGrid: [
    '.product-list-item',  // 2026 新格式（優先）
    '.sku-item',
    '[data-sku-id]',
    '.sku-item-list .sku-item',
    'li.sku-item',
  ],
  // 商品連結（2026 新格式使用 /product/ 路徑）
  productLink: 'a[href*="/product/"], .sku-title a, .sku-header a, h4.sku-title a, a[href*=".p"]',
  // SKU 識別
  productSku: '[data-sku-id]',
  // 標題
  title: 'h4, .sku-title, .sku-header a, h4.sku-title, [class*="title"]',
  // 價格
  price: '[class*="price"], .priceView-customer-price span, .priceView-hero-price span[aria-hidden="true"]',
  // 評分
  rating: '.c-ratings-reviews .ugc-c-review-average, .c-ratings-reviews-v4 .c-ratings-reviews',
  // 評論數
  reviewCount: '.c-reviews .c-total-reviews, .c-ratings-reviews-v4 .c-total-reviews',
  // 分頁
  pagination: {
    nextPage: '.sku-list-page-next, [aria-label="Next page"]',
    loadMore: '.load-more-button, [data-track="load-more"]',
  },
} as const;
