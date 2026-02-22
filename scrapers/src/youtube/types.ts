/**
 * YouTube Scraper - 類型定義
 */

// yt-dlp 輸出的影片資訊
export interface YtDlpVideoInfo {
  id: string;
  title: string;
  description: string;
  channel: string;
  channel_id: string;
  channel_follower_count: number;
  uploader: string;
  uploader_id: string;
  view_count: number;
  like_count: number;
  duration: number; // 秒
  upload_date: string; // YYYYMMDD
  webpage_url: string;
  thumbnail: string;
  categories: string[];
  tags: string[];
  is_paid_promotion?: boolean;
  comments?: YtDlpComment[];
}

// yt-dlp 輸出的留言
export interface YtDlpComment {
  id: string;
  text: string;
  author: string;
  author_id: string;
  author_is_verified?: boolean;
  like_count: number;
  timestamp: number; // Unix timestamp
  parent: string; // "root" 或父留言 ID
  is_favorited?: boolean;
}

// 搜尋結果（--flat-playlist 輸出）
export interface YtDlpSearchResult {
  id: string;
  title: string;
  url: string;
  duration: number;
  view_count: number;
  channel: string;
  channel_id: string;
}

// Scraper 選項
export interface YouTubeScraperOptions {
  query: string;
  output: string;
  maxVideos?: number;
  maxComments?: number;
  minDuration?: number; // 最小時長（秒），預設 180
  excludeSponsored?: boolean;
}

// 影片類型判斷
export type VideoType = 'review' | 'comparison' | 'unboxing' | 'long_term' | 'problem' | 'other';

// 影片類型關鍵字
export const VIDEO_TYPE_KEYWORDS: Record<VideoType, string[]> = {
  review: ['review', '評測', '開箱', 'レビュー', 'hands on', 'honest review'],
  comparison: ['vs', 'comparison', '對比', 'compared', 'versus', 'which is better'],
  unboxing: ['unboxing', '開箱', 'unbox', 'first look', 'first impressions'],
  long_term: ['after', 'months later', 'year later', '長期使用', 'long term', 'still worth'],
  problem: ['problems', 'issues', '問題', 'don\'t buy', 'honest', 'worst', 'disappointing'],
  other: [],
};

// 贊助聲明關鍵字
export const SPONSORED_KEYWORDS = [
  '#ad',
  '#sponsored',
  '#partner',
  'sponsored by',
  'paid promotion',
  'paid partnership',
  '贊助',
  'この動画は提供',
  'this video is sponsored',
  'thanks to',
  'partnered with',
];
