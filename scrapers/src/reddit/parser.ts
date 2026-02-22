/**
 * Reddit Scraper - 解析器
 */

import type {
  RedditPost,
  RedditComment,
  RedditListing,
  SearchResult,
} from './types.js';
import type { SocialPost, PostEngagement, PostContext, AIExtracted } from '../common/types.js';

/**
 * 解析 Reddit 搜尋結果
 */
export function parseSearchResults(listing: RedditListing<RedditPost>): SearchResult[] {
  return listing.data.children
    .filter((child) => child.kind === 't3') // t3 = post
    .map((child) => {
      const post = child.data;
      return {
        postId: post.id,
        title: post.title,
        url: `https://reddit.com${post.permalink}`,
        subreddit: post.subreddit,
        score: post.score,
        numComments: post.num_comments,
        createdAt: new Date(post.created_utc * 1000),
        author: post.author,
      };
    });
}

/**
 * 將 Reddit Post 轉換為 SocialPost 格式
 */
export function postToSocialPost(
  post: RedditPost,
  aiExtracted?: AIExtracted
): SocialPost {
  const engagement: PostEngagement = {
    upvotes: Math.round(post.score * post.upvote_ratio),
    downvotes: Math.round(post.score * (1 - post.upvote_ratio)),
    replies: post.num_comments,
  };

  const context: PostContext = {
    thread_title: post.title,
    subreddit: post.subreddit,
  };

  return {
    post_id: post.id,
    platform: 'reddit',
    post_type: 'thread',
    author: post.author,
    author_verified: false, // Reddit 沒有驗證機制
    content: post.selftext || post.title,
    date: formatDate(new Date(post.created_utc * 1000)),
    url: `https://reddit.com${post.permalink}`,
    engagement,
    context,
    language: 'en', // 預設英文
    ai_extracted: aiExtracted,
  };
}

/**
 * 將 Reddit Comment 轉換為 SocialPost 格式
 */
export function commentToSocialPost(
  comment: RedditComment,
  threadTitle: string,
  subreddit: string,
  aiExtracted?: AIExtracted
): SocialPost {
  const engagement: PostEngagement = {
    upvotes: comment.score,
    replies: countReplies(comment.replies),
  };

  const context: PostContext = {
    parent_id: comment.parent_id,
    thread_title: threadTitle,
    subreddit: subreddit,
  };

  return {
    post_id: comment.id,
    platform: 'reddit',
    post_type: 'comment',
    author: comment.author,
    author_verified: false,
    content: comment.body,
    date: formatDate(new Date(comment.created_utc * 1000)),
    url: `https://reddit.com/comments/${comment.link_id.replace('t3_', '')}/_/${comment.id}`,
    engagement,
    context,
    language: 'en',
    ai_extracted: aiExtracted,
  };
}

/**
 * 遞迴提取所有留言
 */
export function extractAllComments(
  replies: RedditListing<RedditComment> | '' | undefined,
  maxDepth: number = 5
): RedditComment[] {
  if (!replies || replies === '' || maxDepth <= 0) {
    return [];
  }

  const comments: RedditComment[] = [];

  for (const child of replies.data.children) {
    if (child.kind === 't1') {
      comments.push(child.data);
      // 遞迴提取回覆
      const nestedComments = extractAllComments(child.data.replies, maxDepth - 1);
      comments.push(...nestedComments);
    }
  }

  return comments;
}

/**
 * 計算回覆數
 */
function countReplies(replies: RedditListing<RedditComment> | '' | undefined): number {
  if (!replies || replies === '') {
    return 0;
  }
  return replies.data.children.filter((c) => c.kind === 't1').length;
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 過濾低品質內容
 */
export function filterLowQualityPosts(
  posts: SearchResult[],
  options: {
    minScore?: number;
    maxAgeYears?: number;
    excludeNsfw?: boolean;
  } = {}
): SearchResult[] {
  const { minScore = 5, maxAgeYears = 2, excludeNsfw = true } = options;
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - maxAgeYears);

  return posts.filter((post) => {
    // 最小分數
    if (post.score < minScore) return false;
    // 最大年齡
    if (post.createdAt < maxDate) return false;
    return true;
  });
}

/**
 * 去重（依 post ID）
 */
export function deduplicatePosts(posts: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.postId)) return false;
    seen.add(post.postId);
    return true;
  });
}

/**
 * 計算聚合統計
 */
export function calculateAggregatedStats(posts: SocialPost[]): {
  total_posts: number;
  positive_posts: number;
  negative_posts: number;
  neutral_posts: number;
  mixed_posts: number;
  avg_engagement: number;
  date_range: { earliest: string; latest: string };
} {
  const sentimentCounts = {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  };

  let totalEngagement = 0;
  let earliest = posts[0]?.date || '';
  let latest = posts[0]?.date || '';

  for (const post of posts) {
    // 統計情感
    const sentiment = post.ai_extracted?.sentiment_inference || 'neutral';
    sentimentCounts[sentiment]++;

    // 計算 engagement
    const engagement = (post.engagement.upvotes || 0) + (post.engagement.replies || 0);
    totalEngagement += engagement;

    // 更新日期範圍
    if (post.date < earliest) earliest = post.date;
    if (post.date > latest) latest = post.date;
  }

  return {
    total_posts: posts.length,
    positive_posts: sentimentCounts.positive,
    negative_posts: sentimentCounts.negative,
    neutral_posts: sentimentCounts.neutral,
    mixed_posts: sentimentCounts.mixed,
    avg_engagement: posts.length > 0 ? totalEngagement / posts.length : 0,
    date_range: { earliest, latest },
  };
}
