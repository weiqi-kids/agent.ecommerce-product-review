/**
 * JSONL 輸出工具 — 含分批邏輯
 *
 * 每行 JSONL 最多包含 batchSize 則評論。
 * 第一行帶完整商品描述，後續行僅帶基本商品資訊。
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ProductReviewData, Review, Product, RatingSummary, ScrapeMeta } from './types.js';

export interface OutputOptions {
  batchSize: number;       // 每行最多評論數（預設 50）
  outputDir: string;       // 輸出目錄
  platform: string;        // 平台名稱（用於檔名）
}

/**
 * 將爬蟲結果分批寫入 JSONL
 *
 * @param product - 商品資訊
 * @param ratingSummary - 評分摘要
 * @param reviews - 所有評論
 * @param meta - 爬蟲元資訊（不含 batch 欄位）
 * @param options - 輸出選項
 * @returns 寫入的 JSONL 檔案路徑
 */
export function writeBatchedJsonl(
  product: Product,
  ratingSummary: RatingSummary,
  reviews: Review[],
  meta: Omit<ScrapeMeta, 'batch_index' | 'batch_total' | 'total_reviews_scraped'>,
  options: OutputOptions
): string {
  const { batchSize, outputDir, platform } = options;
  const totalReviews = reviews.length;
  const batchTotal = Math.max(1, Math.ceil(totalReviews / batchSize));

  // 產生檔名：{platform}--{product_id}--{timestamp}.jsonl
  const productId = product.asin || product.upc || 'unknown';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${platform}--${productId}--${timestamp}.jsonl`;
  const filepath = join(outputDir, filename);

  // 確保輸出目錄存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  // 確保檔案為空（覆寫模式）
  if (existsSync(filepath)) {
    writeFileSync(filepath, '');
  }

  for (let batchIndex = 1; batchIndex <= batchTotal; batchIndex++) {
    const startIdx = (batchIndex - 1) * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalReviews);
    const batchReviews = reviews.slice(startIdx, endIdx);

    const record: ProductReviewData = {
      scrape_meta: {
        ...meta,
        batch_index: batchIndex,
        batch_total: batchTotal,
        total_reviews_scraped: totalReviews,
      },
      product: product,
      rating_summary: ratingSummary,
      reviews: batchReviews,
    };

    const line = JSON.stringify(record);
    appendFileSync(filepath, line + '\n');
  }

  console.log(`📝 JSONL written: ${filename} (${batchTotal} batches, ${totalReviews} reviews)`);
  return filepath;
}

/**
 * 解析命令列參數
 */
export function parseCliArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      args[key] = value;
      if (value !== 'true') i++;
    }
  }

  return args;
}
