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

import { launchBrowser, createContext, createPage, randomDelay } from '../common/browser.js';
import { parseCliArgs } from '../common/output.js';
import type { Page } from 'playwright';

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

interface DiscoveredProduct {
  asin: string;
  title: string;
  rank: number;
  price?: string;
  rating?: string;
  reviewCount?: string;
  source: string;
  category: string;
}

async function main() {
  const args = parseCliArgs();

  const source = args['source'] || 'bestsellers';
  const category = args['category'] || 'electronics';
  const limit = parseInt(args['limit'] || '50', 10);
  const outputFile = args['output'];
  const headless = args['headless'] !== 'false';

  // 驗證參數
  const validSources = ['bestsellers', 'movers', 'wishlist', 'newreleases', 'all'];
  if (!validSources.includes(source)) {
    console.error(`❌ 無效的 source: ${source}`);
    console.error(`   有效值: ${validSources.join(', ')}`);
    process.exit(1);
  }

  const categoryPath = CATEGORY_PATHS[category];
  if (categoryPath === undefined) {
    console.error(`❌ 無效的 category: ${category}`);
    console.error(`   有效值: ${Object.keys(CATEGORY_PATHS).join(', ')}`);
    process.exit(1);
  }

  console.log(`🔍 Amazon 商品發現: source=${source}, category=${category}, limit=${limit}`);

  const browser = await launchBrowser({ headless, timeout: 60000 });
  const context = await createContext(browser, { locale: 'en-US', timeout: 60000 });

  try {
    const page = await createPage(context);
    const allProducts: DiscoveredProduct[] = [];

    // 決定要抓取哪些來源
    const sourcesToScrape = source === 'all'
      ? ['bestsellers', 'movers', 'wishlist', 'newreleases']
      : [source];

    for (const src of sourcesToScrape) {
      console.log(`\n📊 抓取 ${src}...`);
      const products = await scrapeDiscoveryPage(page, src, categoryPath, category, limit);
      allProducts.push(...products);
      console.log(`   ✅ 找到 ${products.length} 個商品`);

      // 來源之間加入延遲
      if (sourcesToScrape.length > 1) {
        await randomDelay(2000, 4000);
      }
    }

    // 去重（同一 ASIN 可能出現在多個列表）
    const uniqueProducts = deduplicateProducts(allProducts);
    console.log(`\n📦 共發現 ${uniqueProducts.length} 個不重複商品`);

    // 輸出結果
    if (outputFile) {
      const { writeFileSync } = await import('fs');
      // 輸出 JSONL 格式，每行一個產品
      const lines = uniqueProducts.map(p => JSON.stringify({
        asin: p.asin,
        title: p.title,
        rank: p.rank,
        price: p.price || null,
        rating: p.rating || null,
        review_count: p.reviewCount || null,
        source: p.source,
        category: p.category,
        url: `https://www.amazon.com/dp/${p.asin}`
      }));
      writeFileSync(outputFile, lines.join('\n') + '\n');
      console.log(`\n✅ 已輸出到 ${outputFile}（JSONL 格式）`);
    } else {
      // 輸出到 console
      console.log('\n--- 發現的商品 ---');
      for (const p of uniqueProducts.slice(0, 20)) {
        console.log(`[${p.rank}] ${p.asin} - ${p.title.slice(0, 60)}...`);
      }
      if (uniqueProducts.length > 20) {
        console.log(`... 還有 ${uniqueProducts.length - 20} 個商品`);
      }

      // 輸出 ASIN 列表方便複製
      console.log('\n--- ASIN 列表 ---');
      console.log(uniqueProducts.map(p => p.asin).join('\n'));
    }

  } finally {
    await context.close();
    await browser.close();
  }
}

async function scrapeDiscoveryPage(
  page: Page,
  source: string,
  categoryPath: string,
  categoryName: string,
  limit: number
): Promise<DiscoveredProduct[]> {
  const urlTemplate = DISCOVERY_URLS[source];
  const url = urlTemplate.replace('{category}', categoryPath);

  console.log(`   📄 載入 ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  // 等待商品列表載入
  try {
    await page.waitForSelector('[data-asin]', { timeout: 10000 });
  } catch {
    console.log(`   ⚠️ 未找到商品元素，可能頁面結構不同`);
  }

  // 捲動載入更多商品
  await scrollToLoadMore(page, limit);

  // 提取商品資訊
  const products = await extractProducts(page, source, categoryName, limit);

  return products;
}

async function scrollToLoadMore(page: Page, targetCount: number): Promise<void> {
  let lastHeight = 0;
  let scrollAttempts = 0;
  const maxScrolls = Math.ceil(targetCount / 10); // 大約每次捲動載入 10 個

  while (scrollAttempts < maxScrolls) {
    // 捲動到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(1000, 2000);

    // 檢查是否有新內容
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) {
      break; // 沒有更多內容
    }
    lastHeight = newHeight;
    scrollAttempts++;
  }
}

async function extractProducts(
  page: Page,
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
    const elements = await page.$$(selector);
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

        if (!asin || asin.length !== 10) continue;

        // 提取標題
        const titleEl = await el.$('span.zg-text-center-align, a.a-link-normal span, span.a-size-base');
        const title = titleEl ? (await titleEl.textContent())?.trim() || '' : '';

        // 提取排名（如果有）
        const rankEl = await el.$('span.zg-bdg-text, span.zg-badge-text');
        const rankText = rankEl ? (await rankEl.textContent())?.trim() || '' : '';
        const extractedRank = parseInt(rankText.replace('#', ''), 10) || rank;

        // 提取價格
        const priceEl = await el.$('span.a-price span.a-offscreen, span.p13n-sc-price');
        const price = priceEl ? (await priceEl.textContent())?.trim() || '' : '';

        // 提取評分
        const ratingEl = await el.$('span.a-icon-alt, i.a-icon-star-small');
        const rating = ratingEl ? (await ratingEl.textContent())?.trim() || '' : '';

        // 提取評論數
        const reviewEl = await el.$('span.a-size-small');
        const reviewCount = reviewEl ? (await reviewEl.textContent())?.trim() || '' : '';

        // 檢查是否已存在
        if (!products.find(p => p.asin === asin)) {
          products.push({
            asin,
            title: title || `Product ${asin}`,
            rank: extractedRank,
            price,
            rating,
            reviewCount,
            source,
            category,
          });
        }

        rank++;
      } catch (err) {
        // 忽略單個元素錯誤
        continue;
      }
    }

    if (products.length > 0) break; // 已找到商品，不需要嘗試其他選擇器
  }

  return products;
}

function deduplicateProducts(products: DiscoveredProduct[]): DiscoveredProduct[] {
  const seen = new Map<string, DiscoveredProduct>();

  for (const p of products) {
    if (!seen.has(p.asin)) {
      seen.set(p.asin, p);
    } else {
      // 保留排名較高的
      const existing = seen.get(p.asin)!;
      if (p.rank < existing.rank) {
        seen.set(p.asin, p);
      }
    }
  }

  // 按排名排序
  return Array.from(seen.values()).sort((a, b) => a.rank - b.rank);
}

main().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
