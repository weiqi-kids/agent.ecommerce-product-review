/**
 * Walmart 熱門商品發現爬蟲
 *
 * 支援 4 種資料源：
 *   - best-sellers: 銷售排行榜
 *   - trending: 趨勢產品
 *   - deals: 特價商品
 *   - new-arrivals: 新品上架
 *
 * 用法：
 *   # 抓取電子產品 Best Sellers 前 50 名
 *   npx tsx src/walmart/discovery.ts --source best-sellers --category electronics --limit 50
 *
 *   # 抓取所有來源的電腦產品
 *   npx tsx src/walmart/discovery.ts --source all --category computers --limit 20
 *
 *   # 輸出到檔案（JSONL 格式）
 *   npx tsx src/walmart/discovery.ts --source best-sellers --output ./discovered.jsonl
 */

import { BaseDiscovery } from '../common/discovery/base.js';
import type { DiscoveryConfig, DiscoveredProduct } from '../common/discovery/types.js';
import { DISCOVERY_SELECTORS, extractProductIdFromUrl } from './selectors.js';

// Walmart 熱門頁面 URL 模板
const DISCOVERY_URLS: Record<string, string> = {
  'best-sellers': 'https://www.walmart.com/shop/best-sellers',
  'trending': 'https://www.walmart.com/shop/trending',
  'deals': 'https://www.walmart.com/shop/deals',
  'new-arrivals': 'https://www.walmart.com/shop/new-arrivals',
};

// 品類對應的 URL path
const CATEGORY_PATHS: Record<string, string> = {
  electronics: 'electronics',
  computers: 'computers',
  'cell-phones': 'cell-phones',
  home: 'home',
  'tv-video': 'tv-video',
  toys: 'toys',
  baby: 'baby',
  beauty: 'beauty',
  health: 'health',
  'sports-outdoors': 'sports-outdoors',
  automotive: 'auto-tires',
  'food-beverage': 'food',
  pet: 'pets',
  all: '', // 全站
};

const config: DiscoveryConfig = {
  platform: 'Walmart',
  validSources: ['best-sellers', 'trending', 'deals', 'new-arrivals'],
  categoryPaths: CATEGORY_PATHS,
  urlTemplates: DISCOVERY_URLS,
  productIdValidator: (id: string) => /^\d+$/.test(id),
  buildProductUrl: (id: string) => `https://www.walmart.com/ip/${id}`,
};

class WalmartDiscovery extends BaseDiscovery {
  constructor() {
    super(config);
  }

  protected buildSourceUrl(source: string, category: string): string {
    let url = DISCOVERY_URLS[source];
    const categoryPath = CATEGORY_PATHS[category] || '';

    // 如果有品類，加入 URL path
    if (categoryPath) {
      url += `/${categoryPath}`;
    }

    return url;
  }

  protected async waitForProducts(): Promise<void> {
    try {
      await this.page!.waitForSelector('[data-item-id], [data-testid="item-stack"]', { timeout: 10000 });
    } catch {
      console.log(`   ⚠️ 未找到商品元素，嘗試其他選擇器`);
    }
  }

  protected async extractProducts(
    source: string,
    category: string,
    limit: number
  ): Promise<DiscoveredProduct[]> {
    const products: DiscoveredProduct[] = [];

    // Walmart 商品選擇器
    const selectors = DISCOVERY_SELECTORS.productGrid;

    for (const selector of selectors) {
      const elements = await this.page!.$$(selector);
      if (elements.length === 0) continue;

      console.log(`   使用選擇器: ${selector} (找到 ${elements.length} 個)`);

      let rank = 1;
      for (const el of elements) {
        if (products.length >= limit) break;

        try {
          // 提取 Product ID
          let productId = await el.getAttribute('data-item-id');
          if (!productId) {
            productId = await el.getAttribute('data-product-id');
          }
          if (!productId) {
            // 嘗試從連結提取
            const link = await el.$('a[href*="/ip/"]');
            if (link) {
              const href = await link.getAttribute('href');
              productId = href ? extractProductIdFromUrl(href) : null;
            }
          }

          if (!productId || !this.config.productIdValidator(productId)) continue;

          // 提取標題
          const titleEl = await el.$('[data-automation-id="product-title"], .product-title-link span, [data-testid="product-title-link"] span');
          const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

          // 提取價格
          const priceEl = await el.$('[data-automation-id="product-price"] span, .price-characteristic, [itemprop="price"]');
          const price = priceEl ? (await priceEl.textContent())?.trim() || null : null;

          // 提取評分
          const ratingEl = await el.$('[data-testid="product-ratings"] .stars-container, .rating-stars');
          let rating: string | null = null;
          if (ratingEl) {
            const ratingText = await ratingEl.getAttribute('aria-label');
            rating = ratingText || null;
          }

          // 提取評論數
          const reviewEl = await el.$('[data-testid="product-ratings"] .rating-number, .reviews-count');
          const reviewCount = reviewEl ? (await reviewEl.textContent())?.trim() || null : null;

          // 檢查是否已存在
          if (!products.find(p => p.product_id === productId)) {
            products.push({
              product_id: productId,
              title: title || `Product ${productId}`,
              rank,
              price,
              rating,
              review_count: reviewCount,
              source,
              category,
            });
          }

          rank++;
        } catch {
          // 忽略單個元素錯誤
          continue;
        }
      }

      if (products.length > 0) break; // 已找到商品，不需要嘗試其他選擇器
    }

    return products;
  }
}

// 執行
new WalmartDiscovery().run().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
