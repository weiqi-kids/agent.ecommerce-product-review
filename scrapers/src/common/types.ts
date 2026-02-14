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
