/**
 * Best Buy 熱門商品發現爬蟲
 *
 * 支援 4 種資料源：
 *   - top-rated: 高評價產品
 *   - best-sellers: 銷售排行榜（遊戲類）
 *   - deals: 特價商品（TV deals）
 *   - new-arrivals: 新品上架
 *
 * 用法：
 *   # 抓取電子產品 Top Rated 前 50 名
 *   npx tsx src/bestbuy/discovery.ts --source top-rated --category electronics --limit 50
 *
 *   # 抓取所有來源的電腦產品
 *   npx tsx src/bestbuy/discovery.ts --source all --category computers --limit 20
 *
 *   # 輸出到檔案（JSONL 格式）
 *   npx tsx src/bestbuy/discovery.ts --source best-sellers --output ./discovered.jsonl
 *
 * 注意：Best Buy 有較強的反爬蟲機制，headless 模式可能無法正常運作。
 *       建議使用 --headless false 開啟瀏覽器視窗執行。
 */

import { BaseDiscovery } from '../common/discovery/base.js';
import type {
  DiscoveryConfig,
  DiscoveredProduct,
  DiscoveryOptions,
  ContextOptions,
  CookieConfig,
  ScrollConfig,
} from '../common/discovery/types.js';
import { extractSkuFromUrl } from './selectors.js';

// Best Buy 熱門頁面 URL 模板（2026 年更新格式）
// 注意：Best Buy 使用 /site/misc/ 和 /site/shop/ 路徑，非 /site/promo/
const DISCOVERY_URLS: Record<string, string> = {
  'top-rated': 'https://www.bestbuy.com/site/misc/top-rated-products/pcmcat140900050011.c?id=pcmcat140900050011',
  'best-sellers': 'https://www.bestbuy.com/site/shop/best-seller-games',  // 遊戲類最熱銷
  'deals': 'https://www.bestbuy.com/site/promo/tv-deals',  // TV deals
  'new-arrivals': 'https://www.bestbuy.com/site/promo/new-arrivals',
};

// 品類對應的 category ID（用於過濾）
const CATEGORY_PATHS: Record<string, string> = {
  electronics: 'abcat0100000',
  computers: 'abcat0500000',
  'cell-phones': 'abcat0800000',
  appliances: 'abcat0900000',
  tv: 'abcat0101000',
  audio: 'abcat0200000',
  cameras: 'abcat0400000',
  gaming: 'abcat0700000',
  wearables: 'pcmcat332000050000',
  'smart-home': 'pcmcat254000050002',
  all: '', // 全站
};

const config: DiscoveryConfig = {
  platform: 'Best Buy',
  validSources: ['top-rated', 'best-sellers', 'deals', 'new-arrivals'],
  categoryPaths: CATEGORY_PATHS,
  urlTemplates: DISCOVERY_URLS,
  productIdValidator: (id: string) => id.length >= 5,  // 支援新舊格式
  buildProductUrl: (id: string) => {
    // 根據 ID 格式選擇 URL：7 位數字用舊格式，其他用新格式
    const isOldFormat = /^\d{7}$/.test(id);
    return isOldFormat
      ? `https://www.bestbuy.com/site/${id}.p`
      : `https://www.bestbuy.com/product/${id}`;
  },
};

class BestBuyDiscovery extends BaseDiscovery {
  constructor() {
    super(config);
  }

  // 覆寫：添加 geolocation 跳過國家選擇
  protected getContextOptions(_options: DiscoveryOptions): ContextOptions {
    return {
      locale: 'en-US',
      timeout: 60000,
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
      permissions: ['geolocation'],
    };
  }

  // 覆寫：添加 cookies 跳過國家選擇頁面
  protected getExtraCookies(): CookieConfig[] {
    return [
      { name: 'intl_splash', value: 'false', domain: '.bestbuy.com', path: '/' },
      { name: 'UID', value: 'US', domain: '.bestbuy.com', path: '/' },
    ];
  }

  // 覆寫：Best Buy 特殊的 skeleton 等待和較慢的捲動
  protected getScrollConfig(): ScrollConfig {
    return {
      itemsPerScroll: 5,
      minDelay: 1500,
      maxDelay: 2500,
      skeletonSelector: '.skeleton-product-grid-view',
      skeletonTimeout: 5000,
    };
  }

  // 覆寫：Headless 模式警告
  protected printHeadlessWarning(): void {
    console.log(`\n⚠️  未找到商品。Best Buy 有較強的反爬蟲機制。`);
    console.log(`   建議使用 --headless false 開啟瀏覽器視窗執行。`);
  }

  protected buildSourceUrl(source: string, category: string): string {
    let url = DISCOVERY_URLS[source];
    const categoryId = CATEGORY_PATHS[category] || '';

    // 如果有品類過濾，加入 URL 參數
    if (categoryId) {
      url += `?qp=category_facet%3DCategory~${categoryId}`;
    }

    return url;
  }

  protected async waitForProducts(): Promise<void> {
    try {
      await this.page!.waitForSelector('.sku-item, [data-sku-id], .product-list-item', { timeout: 10000 });
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

    // Best Buy 商品選擇器（2026 新格式優先）
    // 排除：skeleton（載入中）、full-width（分隔線/廣告）、display-ad（廣告）
    const selectors = [
      '.product-list-item:not(:has(.skeleton-product-grid-view)):not(.full-width-divider):not(.full-width):not(:has(.display-ad-wrapper))',
      '.sku-item',
      '[data-sku-id]',
      '.sku-item-list .sku-item',
      'li.sku-item',
    ];

    for (const selector of selectors) {
      const elements = await this.page!.$$(selector);
      if (elements.length === 0) continue;

      console.log(`   使用選擇器: ${selector} (找到 ${elements.length} 個有效商品)`);

      let rank = 1;
      for (const el of elements) {
        if (products.length >= limit) break;

        try {
          // 提取產品 ID（支援新舊格式）
          let productId = await el.getAttribute('data-sku-id');

          if (!productId) {
            // 嘗試從任何連結提取（包含 Best Buy 各種格式）
            const linkSelectors = [
              'a[href*="/product/"]',
              'a[href*=".p"]',
              'a[href*="/site/"]',
              'h4 a',
              '.sku-title a',
              'a.image-link',
              'a',  // 最後嘗試任何連結
            ];
            let foundHref: string | null = null;
            for (const sel of linkSelectors) {
              const link = await el.$(sel);
              if (link) {
                const href = await link.getAttribute('href');
                if (href && (href.includes('/product/') || href.includes('/site/') || href.includes('.p'))) {
                  foundHref = href;
                  productId = extractSkuFromUrl(href);
                  if (productId) break;
                }
              }
            }
            // 如果還是沒找到，嘗試從 sku-block 結構提取
            if (!productId) {
              const skuBlock = await el.$('.sku-block');
              if (skuBlock) {
                // 列出所有連結
                const allLinks = await skuBlock.$$('a');
                for (const link of allLinks) {
                  const href = await link.getAttribute('href');
                  if (href && href !== '#' && (href.includes('/product/') || href.includes('/site/') || href.includes('.p'))) {
                    const extracted = extractSkuFromUrl(href);
                    if (extracted) {
                      productId = extracted;
                      break;
                    }
                  }
                }
                // 嘗試從 sku-block 的 data 屬性提取
                if (!productId) {
                  const skuEl = await skuBlock.$('[data-sku-id]');
                  if (skuEl) {
                    productId = await skuEl.getAttribute('data-sku-id');
                  }
                }
              }
            }
          }

          // 驗證產品 ID
          if (!productId || !this.config.productIdValidator(productId)) continue;

          // 提取標題
          const titleEl = await el.$('h4, .sku-title, .sku-header a, h4.sku-title, [class*="title"]');
          const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

          // 提取價格
          const priceEl = await el.$('[class*="price"], .priceView-customer-price span');
          const price = priceEl ? (await priceEl.textContent())?.trim() || null : null;

          // 提取評分
          const ratingEl = await el.$('.c-ratings-reviews .ugc-c-review-average, .c-ratings-reviews-v4 .c-ratings-reviews');
          let rating: string | null = null;
          if (ratingEl) {
            const ratingText = await ratingEl.getAttribute('aria-label');
            rating = ratingText || (await ratingEl.textContent())?.trim() || null;
          }

          // 提取評論數
          const reviewEl = await el.$('.c-reviews .c-total-reviews, .c-ratings-reviews-v4 .c-total-reviews');
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
new BestBuyDiscovery().run().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
