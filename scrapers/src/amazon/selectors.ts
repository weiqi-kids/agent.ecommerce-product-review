/**
 * Amazon CSS/XPath 選擇器定義
 * 集中管理所有選擇器，方便維護
 */

export const SELECTORS = {
  // === 商品頁面 ===
  product: {
    title: '#productTitle',
    brand: '#bylineInfo',
    price: '.a-price .a-offscreen',
    rating: '#acrPopover .a-icon-alt',
    ratingCount: '#acrCustomerReviewText',
    description: '#productDescription',
    bulletPoints: '#feature-bullets .a-list-item',
    breadcrumb: '#wayfinding-breadcrumbs_container .a-link-normal',
    asin: 'input[name="ASIN"], [data-asin]',
    sellerName: '#sellerProfileTriggerId, #merchant-info',
    // 商品主圖（依優先順序）
    image: '#landingImage, #imgBlkFront, #main-image, #ebooksImgBlkFront',
  },

  // === 評論列表頁 ===
  reviews: {
    container: '[data-hook="review"]',
    // 備用容器選擇器（商品頁可能使用不同結構）
    containerFallbacks: [
      '#cm-cr-dp-review-list [data-hook="review"]',
      '.a-section.review',
      '#customerReviews [data-hook="review"]',
    ],
    title: '[data-hook="review-title"] span:not(.a-color-secondary)',
    body: '[data-hook="review-body"] span',
    rating: '[data-hook="review-star-rating"] .a-icon-alt, [data-hook="cmps-review-star-rating"] .a-icon-alt',
    date: '[data-hook="review-date"]',
    verifiedPurchase: '[data-hook="avp-badge"]',
    helpfulVotes: '[data-hook="helpful-vote-statement"]',
    reviewId: '[data-hook="review"]',
    pagination: {
      nextPage: 'li.a-last a',
    },
    // 展開更多評論的按鈕
    expandButtons: [
      '[data-hook="see-all-reviews-link-foot"]',
      '#reviews-medley-footer a',
      '.cr-lighthouse-more-reviews',
    ],
  },

  // === 評分分佈 ===
  ratingDistribution: {
    histogram: '#histogramTable tr',
    starLabel: '.a-text-right .a-size-base a',
    percentage: '.a-text-right + td .a-size-base a',
  },

  // === 評論頁 URL ===
  reviewsPageLink: '[data-hook="see-all-reviews-link-foot"]',
} as const;

/**
 * 商品標題備用選擇器（依優先順序嘗試）
 */
export const TITLE_FALLBACKS: string[] = [
  '#title',
  'h1 span#productTitle',
  'h1 span',
  '#btAsinTitle',
  '.product-title-word-break',
  '#item_name',
];

/**
 * 從 Amazon URL 提取 ASIN
 */
export function extractAsinFromUrl(url: string): string | null {
  // 匹配 /dp/ASIN 或 /product-reviews/ASIN
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/product-reviews\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/ASIN\/([A-Z0-9]{10})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 根據 ASIN 構建評論頁 URL
 */
export function buildReviewsUrl(asin: string, domain: string = 'www.amazon.com', pageNumber: number = 1): string {
  return `https://${domain}/product-reviews/${asin}/ref=cm_cr_getr_d_paging_btm_next_${pageNumber}?ie=UTF8&reviewerType=all_reviews&pageNumber=${pageNumber}&sortBy=recent`;
}

/**
 * Amazon 各地區域名
 */
export const AMAZON_DOMAINS: Record<string, string> = {
  'en-US': 'www.amazon.com',
  'ja-JP': 'www.amazon.co.jp',
  'en-GB': 'www.amazon.co.uk',
  'de-DE': 'www.amazon.de',
  'fr-FR': 'www.amazon.fr',
  'zh-TW': 'www.amazon.com',  // 台灣用戶常用 US 站
};
