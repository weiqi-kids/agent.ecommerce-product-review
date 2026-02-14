/**
 * Amazon 熱門商品發現爬蟲
 *
 * 支援 4 種資料源：
 *   - bestsellers: 銷量排行榜
 *   - movers: 24小時排名上升最快
 *   - wishlist: 願望清單最多
 *   - newreleases: 熱門新品
 *
 * 用法：
 *   # 抓取電子產品 Best Sellers 前 50 名
 *   npx tsx src/amazon/discovery.ts --source bestsellers --category electronics --limit 50
 *
 *   # 抓取所有來源的美妝產品
 *   npx tsx src/amazon/discovery.ts --source all --category beauty --limit 20
 *
 *   # 輸出到檔案（JSONL 格式）
 *   npx tsx src/amazon/discovery.ts --source bestsellers --output ./discovered.jsonl
 */

import { BaseDiscovery } from '../common/discovery/base.js';
import type { DiscoveryConfig, DiscoveredProduct } from '../common/discovery/types.js';

// Amazon 熱門頁面 URL 模板
const DISCOVERY_URLS: Record<string, string> = {
  bestsellers: 'https://www.amazon.com/Best-Sellers/zgbs/{category}',
  movers: 'https://www.amazon.com/gp/movers-and-shakers/{category}',
  wishlist: 'https://www.amazon.com/gp/most-wished-for/{category}',
  newreleases: 'https://www.amazon.com/gp/new-releases/{category}',
};

// 品類對應的 URL path
const CATEGORY_PATHS: Record<string, string> = {
  electronics: 'electronics',
  computers: 'computers',
  'cell-phones': 'wireless',
  'home-kitchen': 'home-garden',
  beauty: 'beauty',
  health: 'hpc',
  toys: 'toys-and-games',
  sports: 'sporting-goods',
  fashion: 'fashion',
  books: 'books',
  automotive: 'automotive',
  baby: 'baby-products',
  pet: 'pet-supplies',
  grocery: 'grocery',
  office: 'office-products',
  all: '', // 全站
};

const config: DiscoveryConfig = {
  platform: 'Amazon',
  validSources: ['bestsellers', 'movers', 'wishlist', 'newreleases'],
  categoryPaths: CATEGORY_PATHS,
  urlTemplates: DISCOVERY_URLS,
  productIdValidator: (id: string) => /^[A-Z0-9]{10}$/.test(id),
  buildProductUrl: (id: string) => `https://www.amazon.com/dp/${id}`,
};

class AmazonDiscovery extends BaseDiscovery {
  constructor() {
    super(config);
  }

  protected buildSourceUrl(source: string, category: string): string {
    const categoryPath = CATEGORY_PATHS[category] || '';
    return DISCOVERY_URLS[source].replace('{category}', categoryPath);
  }

  protected async waitForProducts(): Promise<void> {
    try {
      await this.page!.waitForSelector('[data-asin]', { timeout: 10000 });
    } catch {
      console.log(`   ⚠️ 未找到商品元素，可能頁面結構不同`);
    }
  }

  protected async extractProducts(
    source: string,
    category: string,
    limit: number
  ): Promise<DiscoveredProduct[]> {
    const products: DiscoveredProduct[] = [];

    // Amazon 熱門頁面的商品選擇器
    const selectors = [
      // Best Sellers / New Releases 格式
      'div.zg-grid-general-faceout',
      // Movers & Shakers 格式
      'div.zg-bdg-item',
      // 通用格式
      '[data-asin]:not([data-asin=""])',
      // 列表項格式
      'li.zg-item-immersion',
    ];

    for (const selector of selectors) {
      const elements = await this.page!.$$(selector);
      if (elements.length === 0) continue;

      console.log(`   使用選擇器: ${selector} (找到 ${elements.length} 個)`);

      let rank = 1;
      for (const el of elements) {
        if (products.length >= limit) break;

        try {
          // 提取 ASIN
          let asin = await el.getAttribute('data-asin');
          if (!asin) {
            // 嘗試從連結提取
            const link = await el.$('a[href*="/dp/"]');
            if (link) {
              const href = await link.getAttribute('href');
              const match = href?.match(/\/dp\/([A-Z0-9]{10})/);
              asin = match?.[1] || null;
            }
          }

          if (!asin || !this.config.productIdValidator(asin)) continue;

          // 提取標題
          const titleEl = await el.$('span.zg-text-center-align, a.a-link-normal span, span.a-size-base');
          const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

          // 提取排名（如果有）
          const rankEl = await el.$('span.zg-bdg-text, span.zg-badge-text');
          const rankText = rankEl ? (await rankEl.textContent())?.trim() || '' : '';
          const extractedRank = parseInt(rankText.replace('#', ''), 10) || rank;

          // 提取價格
          const priceEl = await el.$('span.a-price span.a-offscreen, span.p13n-sc-price');
          const price = priceEl ? (await priceEl.textContent())?.trim() || null : null;

          // 提取評分
          const ratingEl = await el.$('span.a-icon-alt, i.a-icon-star-small');
          const rating = ratingEl ? (await ratingEl.textContent())?.trim() || null : null;

          // 提取評論數
          const reviewEl = await el.$('span.a-size-small');
          const reviewCount = reviewEl ? (await reviewEl.textContent())?.trim() || null : null;

          // 檢查是否已存在
          if (!products.find(p => p.product_id === asin)) {
            products.push({
              product_id: asin,
              title: title || `Product ${asin}`,
              rank: extractedRank,
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
new AmazonDiscovery().run().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
