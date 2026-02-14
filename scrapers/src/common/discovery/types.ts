/**
 * Discovery 功能共用類型定義
 */

/**
 * 統一的已發現商品結構
 * 使用 product_id 作為統一欄位（取代 asin/sku/productId）
 */
export interface DiscoveredProduct {
  product_id: string;        // 統一欄位：Amazon=ASIN, BestBuy=SKU, Walmart=ProductID
  title: string;
  rank: number;
  price: string | null;
  rating: string | null;
  review_count: string | null;
  source: string;            // 來源：bestsellers, movers, deals 等
  category: string;          // 類別名稱
}

/**
 * JSONL 輸出格式（各平台統一）
 */
export interface DiscoveryJsonlRecord {
  product_id: string;
  title: string;
  rank: number;
  price: string | null;
  rating: string | null;
  review_count: string | null;
  source: string;
  category: string;
  url: string;
  platform: string;          // 來源平台
  discovered_at: string;     // 發現時間 ISO8601
}

/**
 * Discovery 配置（各平台實作時提供）
 */
export interface DiscoveryConfig {
  platform: string;                              // 平台名稱
  validSources: string[];                        // 有效的來源列表
  categoryPaths: Record<string, string>;         // 類別對應路徑
  urlTemplates: Record<string, string>;          // URL 模板
  productIdValidator: (id: string) => boolean;   // ID 驗證函數
  buildProductUrl: (id: string) => string;       // 構建商品 URL
}

/**
 * Discovery 選項（從 CLI 參數解析）
 */
export interface DiscoveryOptions {
  source: string;
  category: string;
  limit: number;
  outputFile?: string;
  headless: boolean;
}

/**
 * 瀏覽器上下文配置（各平台可自訂）
 */
export interface ContextOptions {
  locale?: string;
  timeout?: number;
  geolocation?: { latitude: number; longitude: number };
  permissions?: string[];
}

/**
 * Cookie 定義
 */
export interface CookieConfig {
  name: string;
  value: string;
  domain: string;
  path: string;
}

/**
 * 捲動載入配置
 */
export interface ScrollConfig {
  itemsPerScroll: number;      // 每次捲動預計載入數量
  minDelay: number;            // 最小延遲（毫秒）
  maxDelay: number;            // 最大延遲（毫秒）
  skeletonSelector?: string;   // skeleton 載入選擇器（可選）
  skeletonTimeout?: number;    // skeleton 等待超時（毫秒）
}
