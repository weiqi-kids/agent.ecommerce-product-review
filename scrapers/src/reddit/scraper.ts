#!/usr/bin/env npx tsx
/**
 * Reddit Scraper
 *
 * 使用方式：
 *   npx tsx src/reddit/scraper.ts --query "AirPods Pro" --output ./output
 *   npx tsx src/reddit/scraper.ts --query "Mighty Patch" --subreddits "SkincareAddiction,acne"
 *   npx tsx src/reddit/scraper.ts --query "Sony WH-1000XM5" --use-api
 *
 * 環境變數：
 *   REDDIT_CLIENT_ID     - Reddit API Client ID
 *   REDDIT_CLIENT_SECRET - Reddit API Client Secret
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';
import type {
  RedditScraperOptions,
  RedditOAuthToken,
  RedditListing,
  RedditPost,
  RedditComment,
  SearchResult,
} from './types.js';
import { CATEGORY_SUBREDDITS, SEARCH_TEMPLATES } from './types.js';
import {
  parseSearchResults,
  postToSocialPost,
  commentToSocialPost,
  extractAllComments,
  filterLowQualityPosts,
  deduplicatePosts,
  calculateAggregatedStats,
} from './parser.js';
import type { SocialSourceData, SocialPost, SocialScrapeMeta, ProductQuery, AggregatedStats } from '../common/types.js';

// ============================================
// Reddit API 客戶端
// ============================================

class RedditApiClient {
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;
  private token: RedditOAuthToken | null = null;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = process.env.REDDIT_USER_AGENT || 'ProductReviewBot/1.0';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  async authenticate(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Reddit API credentials not configured');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Reddit OAuth failed: ${response.status} ${response.statusText}`);
    }

    this.token = await response.json();
    if (this.token) {
      this.token.expires_at = Date.now() + (this.token.expires_in - 60) * 1000;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.token || (this.token.expires_at && Date.now() >= this.token.expires_at)) {
      await this.authenticate();
    }
  }

  async search(
    query: string,
    options: {
      subreddits?: string[];
      sort?: 'relevance' | 'hot' | 'top' | 'new';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
    } = {}
  ): Promise<SearchResult[]> {
    await this.ensureAuthenticated();

    const { subreddits = [], sort = 'relevance', time = 'year', limit = 25 } = options;

    // 如果指定 subreddits，搜尋特定 subreddit
    const subredditParam = subreddits.length > 0 ? subreddits.join('+') : 'all';
    const url = new URL(`https://oauth.reddit.com/r/${subredditParam}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('sort', sort);
    url.searchParams.set('t', time);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('restrict_sr', subreddits.length > 0 ? 'true' : 'false');
    url.searchParams.set('type', 'link');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token?.access_token}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit search failed: ${response.status} ${response.statusText}`);
    }

    const listing: RedditListing<RedditPost> = await response.json();
    return parseSearchResults(listing);
  }

  async getPostWithComments(
    postId: string,
    options: { limit?: number; sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'qa' } = {}
  ): Promise<{ post: RedditPost; comments: RedditComment[] }> {
    await this.ensureAuthenticated();

    const { limit = 100, sort = 'top' } = options;
    const url = new URL(`https://oauth.reddit.com/comments/${postId}`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', sort);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token?.access_token}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit get post failed: ${response.status} ${response.statusText}`);
    }

    const [postListing, commentsListing]: [RedditListing<RedditPost>, RedditListing<RedditComment>] =
      await response.json();

    const post = postListing.data.children[0]?.data;
    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const comments = extractAllComments(commentsListing as unknown as RedditListing<RedditComment>);

    return { post, comments };
  }
}

// ============================================
// 主函式
// ============================================

async function main() {
  // 解析命令列參數
  const { values } = parseArgs({
    options: {
      query: { type: 'string', short: 'q' },
      output: { type: 'string', short: 'o' },
      'max-posts': { type: 'string', short: 'm' },
      subreddits: { type: 'string', short: 's' },
      'use-api': { type: 'boolean' },
      category: { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || !values.query || !values.output) {
    console.log(`
Reddit Scraper - 從 Reddit 抓取產品討論

使用方式：
  npx tsx src/reddit/scraper.ts --query "產品名稱" --output ./output [選項]

選項：
  -q, --query      產品搜尋關鍵字（必填）
  -o, --output     輸出目錄（必填）
  -m, --max-posts  最大貼文數（預設 50）
  -s, --subreddits 指定 subreddits（逗號分隔）
  -c, --category   產品類別（自動選擇 subreddits）
      --use-api    使用 Reddit API（需設定環境變數）
  -h, --help       顯示此說明

環境變數：
  REDDIT_CLIENT_ID      Reddit API Client ID
  REDDIT_CLIENT_SECRET  Reddit API Client Secret

範例：
  npx tsx src/reddit/scraper.ts -q "AirPods Pro" -o ./output
  npx tsx src/reddit/scraper.ts -q "Mighty Patch" -o ./output -s "SkincareAddiction,acne"
  npx tsx src/reddit/scraper.ts -q "LEGO Ideas" -o ./output -c toys_games --use-api
`);
    process.exit(values.help ? 0 : 1);
  }

  const options: RedditScraperOptions = {
    query: values.query,
    output: values.output,
    maxPosts: parseInt(values['max-posts'] || '50', 10),
    subreddits: values.subreddits?.split(',').map((s) => s.trim()),
    useApi: values['use-api'] || false,
  };

  // 如果指定 category 且沒有指定 subreddits，使用預設對應
  if (values.category && !options.subreddits) {
    options.subreddits = CATEGORY_SUBREDDITS[values.category] || CATEGORY_SUBREDDITS.other;
  }

  console.log(`🔍 Reddit Scraper: ${options.query}`);
  console.log(`   Subreddits: ${options.subreddits?.join(', ') || 'all'}`);
  console.log(`   Max posts: ${options.maxPosts}`);
  console.log(`   Mode: ${options.useApi ? 'Reddit API' : 'WebSearch fallback'}`);

  try {
    const result = await scrapeReddit(options);

    // 確保輸出目錄存在
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    // 輸出 JSONL
    const filename = `reddit-${sanitizeFilename(options.query)}-${formatDate(new Date())}.jsonl`;
    const outputPath = path.join(options.output, filename);
    fs.writeFileSync(outputPath, JSON.stringify(result) + '\n');

    console.log(`\n✅ 完成！輸出至：${outputPath}`);
    console.log(`   貼文數：${result.aggregated_stats.total_posts}`);
    console.log(`   正面：${result.aggregated_stats.positive_posts}`);
    console.log(`   負面：${result.aggregated_stats.negative_posts}`);
  } catch (error) {
    console.error('❌ 抓取失敗：', error);
    process.exit(1);
  }
}

// ============================================
// 抓取邏輯
// ============================================

async function scrapeReddit(options: RedditScraperOptions): Promise<SocialSourceData> {
  const client = new RedditApiClient();
  let searchResults: SearchResult[] = [];

  if (options.useApi && client.isConfigured()) {
    // 使用 Reddit API
    console.log('   📡 使用 Reddit API 搜尋...');

    for (const template of SEARCH_TEMPLATES) {
      const query = template.replace('{query}', options.query);
      console.log(`   🔎 搜尋：${query}`);

      try {
        const results = await client.search(query, {
          subreddits: options.subreddits,
          sort: 'relevance',
          time: 'year',
          limit: 25,
        });
        searchResults.push(...results);

        // 隨機延遲 1-3 秒
        await delay(1000 + Math.random() * 2000);
      } catch (error) {
        console.error(`   ⚠️ 搜尋失敗：${query}`, error);
      }
    }
  } else {
    // Fallback: 輸出提示，實際搜尋由 fetch.sh 透過 WebSearch 執行
    console.log('   ⚠️ Reddit API 未設定，請透過 WebSearch 搜尋');
    console.log('   建議執行：');
    for (const template of SEARCH_TEMPLATES) {
      const query = template.replace('{query}', options.query);
      console.log(`   WebSearch: site:reddit.com ${query}`);
    }

    // 返回空結果，讓 fetch.sh 處理
    return createEmptyResult(options);
  }

  // 去重和過濾
  searchResults = deduplicatePosts(searchResults);
  searchResults = filterLowQualityPosts(searchResults, { minScore: 5, maxAgeYears: 2 });

  // 限制數量
  searchResults = searchResults.slice(0, options.maxPosts);
  console.log(`   📊 找到 ${searchResults.length} 個相關貼文`);

  // 抓取每個貼文的詳細內容和留言
  const posts: SocialPost[] = [];

  for (const result of searchResults) {
    try {
      console.log(`   📝 抓取：${result.title.slice(0, 50)}...`);
      const { post, comments } = await client.getPostWithComments(result.postId, { limit: 50 });

      // 轉換為 SocialPost
      posts.push(postToSocialPost(post));

      // 加入重要留言（score > 10）
      for (const comment of comments.filter((c) => c.score > 10).slice(0, 10)) {
        posts.push(commentToSocialPost(comment, post.title, post.subreddit));
      }

      // 隨機延遲 2-4 秒
      await delay(2000 + Math.random() * 2000);
    } catch (error) {
      console.error(`   ⚠️ 抓取失敗：${result.postId}`, error);
    }
  }

  // 計算統計
  const aggregatedStats = calculateAggregatedStats(posts);

  // 組裝結果
  const scrapeMeta: SocialScrapeMeta = {
    platform: 'reddit',
    source_type: 'social',
    scraped_at: new Date().toISOString(),
    search_query: options.query,
    search_results_count: searchResults.length,
    posts_scraped: posts.length,
    relevance_threshold: 0.7,
  };

  const productQuery: ProductQuery = {
    original_query: options.query,
    normalized_name: options.query, // TODO: 實作正規化
    brand: '', // TODO: 從查詢中提取
    category: '', // TODO: 從 subreddits 推斷
    matched_asin: '', // TODO: 從內容中提取
  };

  return {
    scrape_meta: scrapeMeta,
    product_query: productQuery,
    posts,
    aggregated_stats: aggregatedStats,
  };
}

// ============================================
// 工具函式
// ============================================

function createEmptyResult(options: RedditScraperOptions): SocialSourceData {
  return {
    scrape_meta: {
      platform: 'reddit',
      source_type: 'social',
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
      category: '',
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
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
