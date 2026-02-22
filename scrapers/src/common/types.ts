/**
 * 共用型別定義
 * 所有爬蟲的輸出必須符合這些型別
 */

export interface ScrapeMeta {
  platform: string;
  scraped_at: string;       // ISO 8601
  source_url: string;
  locale: string;
  batch_index: number;      // 1-based
  batch_total: number;
  total_reviews_scraped: number;
}

export interface ProductPrice {
  amount: number;
  currency: string;
}

export interface ProductSeller {
  store_id: string;
  store_name: string;
  is_official: boolean;
}

export interface Product {
  asin?: string;           // Amazon ASIN
  upc?: string;            // UPC/EAN (跨平台匹配用)
  sku?: string;            // Best Buy SKU
  walmart_id?: string;     // Walmart Product ID
  title: string;
  brand: string;
  image_url?: string;      // 商品主圖 URL
  price: ProductPrice;
  category_breadcrumb: string[];
  description: string;
  bullet_points: string[];
  seller: ProductSeller;
}

export interface RatingSummary {
  average: number;
  total_count: number;
  distribution: Record<string, number>; // "5": 65210, "4": 12100, etc.
}

export interface Review {
  review_id: string;
  rating: number;
  title: string;
  body: string;
  date: string;             // YYYY-MM-DD
  verified_purchase: boolean;
  helpful_votes: number;
  language: string;
}

export interface ProductReviewData {
  scrape_meta: ScrapeMeta;
  product: Product;
  rating_summary: RatingSummary;
  reviews: Review[];
}

export interface ScraperOptions {
  url: string;
  output: string;
  locale?: string;
  maxReviews?: number;
  batchSize?: number;
  headless?: boolean;
  timeout?: number;
}

// ============================================
// 社群來源類型（Reddit, YouTube, Forums 等）
// ============================================

export type SourceType = 'ecommerce' | 'social' | 'review_site' | 'forum';

export interface SocialScrapeMeta {
  platform: string;              // reddit, youtube, trustpilot, etc.
  source_type: SourceType;
  scraped_at: string;            // ISO 8601
  search_query: string;          // 用於搜尋的產品名稱/關鍵字
  search_results_count: number;  // 搜尋到的結果數量
  posts_scraped: number;         // 實際抓取的貼文數
  relevance_threshold: number;   // 相關性閾值 (0-1)
}

export interface PostEngagement {
  upvotes?: number;
  downvotes?: number;
  replies?: number;
  helpful_votes?: number;
  views?: number;
  likes?: number;
  shares?: number;
}

export interface PostContext {
  parent_id?: string;            // 回覆的父貼文 ID
  thread_title?: string;         // 討論串標題
  subreddit?: string;            // Reddit 子版
  video_title?: string;          // YouTube 影片標題
  video_id?: string;             // YouTube 影片 ID
  channel_name?: string;         // YouTube 頻道名
  forum_name?: string;           // 論壇名稱
  forum_section?: string;        // 論壇板塊
}

export interface AIExtracted {
  product_mentions: string[];    // 提及的產品名稱
  aspects_mentioned: string[];   // 提及的產品面向
  sentiment_inference: 'positive' | 'negative' | 'mixed' | 'neutral';
  relevance_to_query: number;    // 與搜尋查詢的相關性 (0-1)
  is_sponsored?: boolean;        // 是否為贊助內容
  purchase_verified?: boolean;   // 是否為已驗證購買者
}

export interface SocialPost {
  post_id: string;
  platform: string;
  post_type: 'thread' | 'comment' | 'review' | 'video_comment' | 'forum_post' | 'complaint';
  author: string;
  author_verified?: boolean;     // Trustpilot 驗證買家等
  content: string;
  date: string;                  // YYYY-MM-DD
  url: string;
  engagement: PostEngagement;
  sentiment_raw?: string;        // 平台提供的評分（如 Trustpilot 星級）
  context: PostContext;
  language: string;
  ai_extracted?: AIExtracted;
}

export interface ProductQuery {
  original_query: string;        // 原始搜尋查詢
  normalized_name: string;       // 標準化產品名稱
  brand?: string;
  category?: string;
  matched_asin?: string;         // 對應的 Amazon ASIN
  matched_upc?: string;          // 對應的 UPC
}

export interface AggregatedStats {
  total_posts: number;
  positive_posts: number;
  negative_posts: number;
  neutral_posts: number;
  mixed_posts: number;
  avg_engagement: number;
  date_range: {
    earliest: string;
    latest: string;
  };
}

export interface SocialSourceData {
  scrape_meta: SocialScrapeMeta;
  product_query: ProductQuery;
  posts: SocialPost[];
  aggregated_stats: AggregatedStats;
}

export interface SocialScraperOptions {
  query: string;
  output: string;
  maxPosts?: number;
  relevanceThreshold?: number;   // 預設 0.7
  dateRange?: {
    from?: string;               // YYYY-MM-DD
    to?: string;
  };
  subreddits?: string[];         // Reddit 專用
  forumSections?: string[];      // 論壇專用
}
