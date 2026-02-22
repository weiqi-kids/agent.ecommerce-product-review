#!/usr/bin/env npx tsx
/**
 * YouTube Scraper (yt-dlp)
 *
 * 使用方式：
 *   npx tsx src/youtube/scraper.ts --query "AirPods Pro" --output ./output
 *   npx tsx src/youtube/scraper.ts --query "Sony WH-1000XM5" --max-videos 10
 *
 * 前置需求：
 *   brew install yt-dlp
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';
import { execSync, spawn } from 'child_process';
import type {
  YouTubeScraperOptions,
  YtDlpVideoInfo,
  YtDlpComment,
  YtDlpSearchResult,
  VideoType,
} from './types.js';
import { VIDEO_TYPE_KEYWORDS, SPONSORED_KEYWORDS } from './types.js';
import type {
  SocialSourceData,
  SocialPost,
  SocialScrapeMeta,
  ProductQuery,
  AggregatedStats,
  PostEngagement,
  PostContext,
} from '../common/types.js';

// ============================================
// yt-dlp 封裝
// ============================================

/**
 * 檢查 yt-dlp 是否安裝
 */
function checkYtDlp(): boolean {
  try {
    execSync('yt-dlp --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 搜尋影片
 */
async function searchVideos(query: string, maxResults: number = 20): Promise<YtDlpSearchResult[]> {
  return new Promise((resolve, reject) => {
    const searchQuery = `ytsearch${maxResults}:${query} review`;
    const args = ['--flat-playlist', '-j', '--no-warnings', searchQuery];

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp search failed: ${stderr}`));
        return;
      }

      const results: YtDlpSearchResult[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          results.push({
            id: data.id,
            title: data.title,
            url: data.url || `https://www.youtube.com/watch?v=${data.id}`,
            duration: data.duration || 0,
            view_count: data.view_count || 0,
            channel: data.channel || data.uploader || '',
            channel_id: data.channel_id || '',
          });
        } catch (e) {
          // 跳過解析失敗的行
        }
      }

      resolve(results);
    });
  });
}

/**
 * 取得影片詳細資訊（含留言）
 */
async function getVideoInfo(videoId: string, maxComments: number = 100): Promise<YtDlpVideoInfo | null> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const args = [
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--write-comments',
      `--max-comments=${maxComments}`,
      url,
    ];

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    // 設定超時（60秒）
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timeout'));
    }, 60000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        // 影片可能被刪除或私有
        console.error(`  ⚠️ 無法取得影片資訊: ${videoId}`);
        resolve(null);
        return;
      }

      try {
        const data = JSON.parse(stdout);
        resolve(data as YtDlpVideoInfo);
      } catch (e) {
        reject(new Error(`Failed to parse video info: ${e}`));
      }
    });
  });
}

// ============================================
// 影片分析
// ============================================

/**
 * 判斷影片類型
 */
function detectVideoType(title: string, description: string): VideoType {
  const text = (title + ' ' + description).toLowerCase();

  for (const [type, keywords] of Object.entries(VIDEO_TYPE_KEYWORDS)) {
    if (type === 'other') continue;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return type as VideoType;
      }
    }
  }

  return 'other';
}

/**
 * 檢查是否為贊助內容
 */
function isSponsored(title: string, description: string, isPaidPromotion?: boolean): boolean {
  if (isPaidPromotion) return true;

  const text = (title + ' ' + description).toLowerCase();
  for (const keyword of SPONSORED_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * 過濾影片
 */
function filterVideos(
  videos: YtDlpSearchResult[],
  options: { minDuration?: number; excludeSponsored?: boolean }
): YtDlpSearchResult[] {
  const { minDuration = 180 } = options;

  return videos.filter((video) => {
    // 過濾短影片
    if (video.duration < minDuration) return false;

    // 過濾非評測類型（根據標題初步判斷）
    const type = detectVideoType(video.title, '');
    if (type === 'other') return false;

    return true;
  });
}

// ============================================
// 轉換函式
// ============================================

/**
 * 將 yt-dlp 留言轉換為 SocialPost
 */
function commentToSocialPost(
  comment: YtDlpComment,
  videoInfo: YtDlpVideoInfo
): SocialPost {
  const engagement: PostEngagement = {
    likes: comment.like_count || 0,
    replies: 0, // yt-dlp 不提供回覆數
  };

  const context: PostContext = {
    video_id: videoInfo.id,
    video_title: videoInfo.title,
    channel_name: videoInfo.channel,
    parent_id: comment.parent !== 'root' ? comment.parent : undefined,
  };

  return {
    post_id: `${videoInfo.id}_${comment.id}`,
    platform: 'youtube',
    post_type: 'video_comment',
    author: comment.author,
    author_verified: comment.author_is_verified || false,
    content: comment.text,
    date: formatTimestamp(comment.timestamp),
    url: `https://www.youtube.com/watch?v=${videoInfo.id}&lc=${comment.id}`,
    engagement,
    context,
    language: 'en', // TODO: 實作語言偵測
  };
}

/**
 * 計算聚合統計
 */
function calculateAggregatedStats(posts: SocialPost[]): AggregatedStats {
  // 簡化版：基於留言內容推斷情感
  // 實際使用時應由 AI 萃取層處理
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  const positiveWords = ['love', 'great', 'amazing', 'best', 'excellent', 'perfect', 'awesome'];
  const negativeWords = ['hate', 'worst', 'terrible', 'bad', 'disappointing', 'awful', 'broken'];

  for (const post of posts) {
    const content = post.content.toLowerCase();
    const hasPositive = positiveWords.some((w) => content.includes(w));
    const hasNegative = negativeWords.some((w) => content.includes(w));

    if (hasPositive && !hasNegative) {
      positive++;
    } else if (hasNegative && !hasPositive) {
      negative++;
    } else {
      neutral++;
    }
  }

  let totalEngagement = 0;
  let earliest = posts[0]?.date || '';
  let latest = posts[0]?.date || '';

  for (const post of posts) {
    totalEngagement += (post.engagement.likes || 0);
    if (post.date < earliest) earliest = post.date;
    if (post.date > latest) latest = post.date;
  }

  return {
    total_posts: posts.length,
    positive_posts: positive,
    negative_posts: negative,
    neutral_posts: neutral,
    mixed_posts: 0,
    avg_engagement: posts.length > 0 ? totalEngagement / posts.length : 0,
    date_range: { earliest, latest },
  };
}

// ============================================
// 工具函式
// ============================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

function formatUploadDate(uploadDate: string): string {
  // YYYYMMDD -> YYYY-MM-DD
  if (uploadDate.length === 8) {
    return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
  }
  return uploadDate;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      'max-videos': { type: 'string', short: 'v' },
      'max-comments': { type: 'string', short: 'c' },
      'min-duration': { type: 'string', short: 'd' },
      'exclude-sponsored': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || !values.query || !values.output) {
    console.log(`
YouTube Scraper - 使用 yt-dlp 抓取 YouTube 影片留言

使用方式：
  npx tsx src/youtube/scraper.ts --query "產品名稱" --output ./output [選項]

選項：
  -q, --query            產品搜尋關鍵字（必填）
  -o, --output           輸出目錄（必填）
  -v, --max-videos       最大影片數（預設 15）
  -c, --max-comments     每部影片最大留言數（預設 100）
  -d, --min-duration     最小影片時長，秒（預設 180）
      --exclude-sponsored 排除贊助影片
  -h, --help             顯示此說明

前置需求：
  brew install yt-dlp

範例：
  npx tsx src/youtube/scraper.ts -q "AirPods Pro" -o ./output
  npx tsx src/youtube/scraper.ts -q "Sony WH-1000XM5" -o ./output -v 10 -c 50
`);
    process.exit(values.help ? 0 : 1);
  }

  // 檢查 yt-dlp
  if (!checkYtDlp()) {
    console.error('❌ yt-dlp 未安裝。請執行：brew install yt-dlp');
    process.exit(1);
  }

  const options: YouTubeScraperOptions = {
    query: values.query,
    output: values.output,
    maxVideos: parseInt(values['max-videos'] || '15', 10),
    maxComments: parseInt(values['max-comments'] || '100', 10),
    minDuration: parseInt(values['min-duration'] || '180', 10),
    excludeSponsored: values['exclude-sponsored'] || false,
  };

  console.log(`🎬 YouTube Scraper: ${options.query}`);
  console.log(`   Max videos: ${options.maxVideos}`);
  console.log(`   Max comments per video: ${options.maxComments}`);
  console.log(`   Min duration: ${options.minDuration}s`);

  try {
    const result = await scrapeYouTube(options);

    // 確保輸出目錄存在
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    // 輸出 JSONL
    const filename = `youtube-${sanitizeFilename(options.query)}-${formatDate(new Date())}.jsonl`;
    const outputPath = path.join(options.output, filename);
    fs.writeFileSync(outputPath, JSON.stringify(result) + '\n');

    console.log(`\n✅ 完成！輸出至：${outputPath}`);
    console.log(`   影片數：${result.scrape_meta.search_results_count}`);
    console.log(`   留言數：${result.aggregated_stats.total_posts}`);
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

async function scrapeYouTube(options: YouTubeScraperOptions): Promise<SocialSourceData> {
  // 搜尋影片
  console.log('   🔍 搜尋影片...');
  let searchResults = await searchVideos(options.query, options.maxVideos! * 2);
  console.log(`   📊 找到 ${searchResults.length} 部影片`);

  // 過濾影片
  searchResults = filterVideos(searchResults, {
    minDuration: options.minDuration,
  });
  console.log(`   📊 過濾後 ${searchResults.length} 部影片`);

  // 限制數量
  searchResults = searchResults.slice(0, options.maxVideos);

  // 抓取每部影片的留言
  const posts: SocialPost[] = [];
  let sponsoredCount = 0;
  let videosProcessed = 0;

  for (const result of searchResults) {
    console.log(`   📹 [${videosProcessed + 1}/${searchResults.length}] ${result.title.slice(0, 50)}...`);

    try {
      const videoInfo = await getVideoInfo(result.id, options.maxComments);

      if (!videoInfo) {
        continue;
      }

      // 檢查是否為贊助影片
      const sponsored = isSponsored(
        videoInfo.title,
        videoInfo.description,
        videoInfo.is_paid_promotion
      );

      if (sponsored) {
        sponsoredCount++;
        if (options.excludeSponsored) {
          console.log(`   ⏭️ 跳過贊助影片`);
          continue;
        }
      }

      // 轉換留言
      if (videoInfo.comments && videoInfo.comments.length > 0) {
        for (const comment of videoInfo.comments) {
          const socialPost = commentToSocialPost(comment, videoInfo);

          // 標記贊助
          if (sponsored) {
            socialPost.ai_extracted = {
              ...socialPost.ai_extracted,
              is_sponsored: true,
              product_mentions: [],
              aspects_mentioned: [],
              sentiment_inference: 'neutral',
              relevance_to_query: 0.5,
            };
          }

          posts.push(socialPost);
        }
        console.log(`   💬 ${videoInfo.comments.length} 則留言`);
      }

      videosProcessed++;

      // 隨機延遲 2-5 秒
      await delay(2000 + Math.random() * 3000);
    } catch (error) {
      console.error(`   ⚠️ 抓取失敗: ${result.id}`, error);
    }
  }

  // 計算統計
  const aggregatedStats = calculateAggregatedStats(posts);

  // 組裝結果
  const scrapeMeta: SocialScrapeMeta = {
    platform: 'youtube',
    source_type: 'social',
    scraped_at: new Date().toISOString(),
    search_query: options.query,
    search_results_count: videosProcessed,
    posts_scraped: posts.length,
    relevance_threshold: 0.7,
  };

  const productQuery: ProductQuery = {
    original_query: options.query,
    normalized_name: options.query,
    brand: '',
    category: '',
    matched_asin: '',
  };

  console.log(`   📊 贊助影片：${sponsoredCount}/${videosProcessed}`);

  return {
    scrape_meta: scrapeMeta,
    product_query: productQuery,
    posts,
    aggregated_stats: aggregatedStats,
  };
}

// 執行
main().catch(console.error);
