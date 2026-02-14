/**
 * Discovery 功能共用工具函數
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type {
  DiscoveredProduct,
  DiscoveryConfig,
  DiscoveryOptions,
  DiscoveryJsonlRecord,
} from './types.js';

/**
 * 解析 CLI 參數為 DiscoveryOptions
 */
export function parseDiscoveryArgs(args: Record<string, string>): DiscoveryOptions {
  return {
    source: args['source'] || 'best-sellers',
    category: args['category'] || 'electronics',
    limit: parseInt(args['limit'] || '50', 10),
    outputFile: args['output'],
    headless: args['headless'] !== 'false',
  };
}

/**
 * 驗證參數，返回錯誤訊息或 null
 */
export function validateArgs(
  options: DiscoveryOptions,
  config: DiscoveryConfig
): string | null {
  // 驗證 source
  const allSources = [...config.validSources, 'all'];
  if (!allSources.includes(options.source)) {
    return `❌ 無效的 source: ${options.source}\n   有效值: ${allSources.join(', ')}`;
  }

  // 驗證 category
  const categoryPath = config.categoryPaths[options.category];
  if (categoryPath === undefined) {
    return `❌ 無效的 category: ${options.category}\n   有效值: ${Object.keys(config.categoryPaths).join(', ')}`;
  }

  return null;
}

/**
 * 去重商品列表
 * 保留排名較高（數字較小）的記錄
 */
export function deduplicateProducts<T extends { product_id: string; rank: number }>(
  products: T[]
): T[] {
  const seen = new Map<string, T>();

  for (const p of products) {
    if (!seen.has(p.product_id)) {
      seen.set(p.product_id, p);
    } else {
      const existing = seen.get(p.product_id)!;
      if (p.rank < existing.rank) {
        seen.set(p.product_id, p);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.rank - b.rank);
}

/**
 * 轉換為 JSONL 記錄
 */
export function toJsonlRecords(
  products: DiscoveredProduct[],
  platform: string,
  buildProductUrl: (id: string) => string
): DiscoveryJsonlRecord[] {
  const now = new Date().toISOString();
  return products.map(p => ({
    product_id: p.product_id,
    title: p.title,
    rank: p.rank,
    price: p.price,
    rating: p.rating,
    review_count: p.review_count,
    source: p.source,
    category: p.category,
    url: buildProductUrl(p.product_id),
    platform,
    discovered_at: now,
  }));
}

/**
 * 寫入 JSONL 輸出
 */
export function writeJsonlOutput(
  records: DiscoveryJsonlRecord[],
  outputFile: string
): void {
  // 確保目錄存在
  const dir = dirname(outputFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines = records.map(r => JSON.stringify(r));
  writeFileSync(outputFile, lines.join('\n') + '\n');
}

/**
 * 輸出到 console
 */
export function printConsoleOutput(
  products: DiscoveredProduct[],
  platform: string
): void {
  console.log('\n--- 發現的商品 ---');
  for (const p of products.slice(0, 20)) {
    console.log(`[${p.rank}] ${p.product_id} - ${p.title.slice(0, 60)}...`);
  }
  if (products.length > 20) {
    console.log(`... 還有 ${products.length - 20} 個商品`);
  }

  console.log(`\n--- ${platform} Product ID 列表 ---`);
  console.log(products.map(p => p.product_id).join('\n'));
}

/**
 * 從 URL 提取商品 ID 的通用輔助函數
 */
export function extractIdFromUrl(
  url: string,
  patterns: RegExp[]
): string | null {
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
