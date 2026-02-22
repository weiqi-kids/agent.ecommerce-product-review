#!/usr/bin/env npx tsx
/**
 * 論壇共用 Scraper
 *
 * 使用方式：
 *   npx tsx src/forum-common/scraper.ts --forum headfi --query "Sony WH-1000XM5" --output ./output
 *   npx tsx src/forum-common/scraper.ts --forum avsforum --query "LG C3 OLED" --output ./output
 *
 * 支援論壇：headfi, avsforum, slickdeals, makeupalley, babycenter
 *
 * 注意：此 scraper 需要搭配 AI 來萃取內容。
 * 實際使用時，fetch.sh 會透過 WebSearch + WebFetch 取得內容，
 * 再由 Claude 進行 L1-L6 萃取。
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';
import type {
  ForumScraperOptions,
  ForumType,
  ForumSearchResult,
} from './types.js';
import { FORUM_CONFIGS } from './types.js';
import type {
  SocialSourceData,
  SocialScrapeMeta,
  ProductQuery,
  AggregatedStats,
} from '../common/types.js';

// ============================================
// 主函式
// ============================================

async function main() {
  const { values } = parseArgs({
    options: {
      forum: { type: 'string', short: 'f' },
      query: { type: 'string', short: 'q' },
      output: { type: 'string', short: 'o' },
      'max-posts': { type: 'string', short: 'm' },
      'max-threads': { type: 'string', short: 't' },
      section: { type: 'string', short: 's' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || !values.forum || !values.query || !values.output) {
    console.log(`
論壇共用 Scraper

使用方式：
  npx tsx src/forum-common/scraper.ts --forum <forum> --query "產品名稱" --output ./output

選項：
  -f, --forum        論壇名稱（必填）：headfi, avsforum, slickdeals, makeupalley, babycenter
  -q, --query        產品搜尋關鍵字（必填）
  -o, --output       輸出目錄（必填）
  -m, --max-posts    最大貼文數（預設 50）
  -t, --max-threads  最大討論串數（預設 10）
  -s, --section      指定板塊
  -h, --help         顯示此說明

注意：
  此 scraper 產生搜尋指令模板，實際抓取由 fetch.sh 透過 WebSearch + WebFetch 執行。
  論壇內容需要 AI（Claude）進行萃取。

範例：
  npx tsx src/forum-common/scraper.ts -f headfi -q "Sony WH-1000XM5" -o ./output
  npx tsx src/forum-common/scraper.ts -f avsforum -q "LG C3 OLED" -o ./output
`);
    process.exit(values.help ? 0 : 1);
  }

  const forum = values.forum as ForumType;
  if (!FORUM_CONFIGS[forum]) {
    console.error(`❌ 不支援的論壇：${forum}`);
    console.error(`   支援：${Object.keys(FORUM_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const options: ForumScraperOptions = {
    forum,
    query: values.query,
    output: values.output,
    maxPosts: parseInt(values['max-posts'] || '50', 10),
    maxThreads: parseInt(values['max-threads'] || '10', 10),
    section: values.section,
  };

  const config = FORUM_CONFIGS[forum];
  console.log(`🔍 論壇 Scraper: ${config.name}`);
  console.log(`   查詢: ${options.query}`);
  console.log(`   Max threads: ${options.maxThreads}`);
  console.log(`   Max posts: ${options.maxPosts}`);

  try {
    const result = await generateSearchPlan(options);

    // 確保輸出目錄存在
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    // 輸出搜尋計劃 JSON
    const filename = `${forum}-${sanitizeFilename(options.query)}-${formatDate(new Date())}.json`;
    const outputPath = path.join(options.output, filename);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\n✅ 搜尋計劃已產生：${outputPath}`);
    console.log(`\n📝 執行以下 WebSearch 查詢：`);
    for (const query of result.searchQueries) {
      console.log(`   ${query}`);
    }
    console.log(`\n然後使用 WebFetch 抓取搜尋結果中的 URL，並由 AI 萃取內容。`);
  } catch (error) {
    console.error('❌ 失敗：', error);
    process.exit(1);
  }
}

// ============================================
// 搜尋計劃生成
// ============================================

interface SearchPlan {
  forum: ForumType;
  forumName: string;
  query: string;
  category: string;
  searchQueries: string[];
  expectedSections: string[];
  outputTemplate: SocialSourceData;
}

async function generateSearchPlan(options: ForumScraperOptions): Promise<SearchPlan> {
  const config = FORUM_CONFIGS[options.forum];

  // 生成搜尋查詢
  const searchQueries = [
    config.searchPattern.replace('{query}', options.query),
    `site:${config.domain} "${options.query}" review`,
    `site:${config.domain} "${options.query}" impressions`,
    `site:${config.domain} "${options.query}" problems`,
  ];

  // 空的輸出模板
  const outputTemplate: SocialSourceData = {
    scrape_meta: {
      platform: options.forum,
      source_type: 'forum',
      scraped_at: new Date().toISOString(),
      search_query: options.query,
      search_results_count: 0,
      posts_scraped: 0,
      relevance_threshold: 0.7,
    },
    product_query: {
      original_query: options.query,
      normalized_name: options.query,
      brand: '',
      category: config.category,
      matched_asin: '',
    },
    posts: [],
    aggregated_stats: {
      total_posts: 0,
      positive_posts: 0,
      negative_posts: 0,
      neutral_posts: 0,
      mixed_posts: 0,
      avg_engagement: 0,
      date_range: { earliest: '', latest: '' },
    },
  };

  return {
    forum: options.forum,
    forumName: config.name,
    query: options.query,
    category: config.category,
    searchQueries,
    expectedSections: config.sections,
    outputTemplate,
  };
}

// ============================================
// 工具函式
// ============================================

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 執行
main().catch(console.error);
