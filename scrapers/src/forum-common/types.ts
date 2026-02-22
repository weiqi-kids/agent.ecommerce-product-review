/**
 * 論壇共用類型定義
 * 適用於：Head-Fi, AVS Forum, Slickdeals, MakeupAlley, BabyCenter
 */

import type { SocialSourceData, SocialPost, SocialScrapeMeta, ProductQuery } from '../common/types.js';

// 論壇搜尋選項
export interface ForumScraperOptions {
  query: string;
  output: string;
  forum: ForumType;
  maxPosts?: number;
  maxThreads?: number;
  section?: string;
}

// 支援的論壇
export type ForumType = 'headfi' | 'avsforum' | 'slickdeals' | 'makeupalley' | 'babycenter';

// 論壇配置
export interface ForumConfig {
  name: string;
  domain: string;
  searchPattern: string;
  category: string;
  sections: string[];
}

// 論壇配置表
export const FORUM_CONFIGS: Record<ForumType, ForumConfig> = {
  headfi: {
    name: 'Head-Fi',
    domain: 'head-fi.org',
    searchPattern: 'site:head-fi.org "{query}" review OR impressions',
    category: 'electronics',
    sections: ['Headphones', 'Portable Audio', 'High-end Audio'],
  },
  avsforum: {
    name: 'AVS Forum',
    domain: 'avsforum.com',
    searchPattern: 'site:avsforum.com "{query}" owner\'s thread OR review',
    category: 'electronics',
    sections: ['OLED', 'LCD', 'Projectors', 'Receivers'],
  },
  slickdeals: {
    name: 'Slickdeals',
    domain: 'slickdeals.net',
    searchPattern: 'site:slickdeals.net "{query}"',
    category: 'other',
    sections: ['Deals', 'Forums'],
  },
  makeupalley: {
    name: 'MakeupAlley',
    domain: 'makeupalley.com',
    searchPattern: 'site:makeupalley.com "{query}" review',
    category: 'beauty',
    sections: ['Skincare', 'Makeup', 'Hair'],
  },
  babycenter: {
    name: 'BabyCenter',
    domain: 'babycenter.com',
    searchPattern: 'site:community.babycenter.com "{query}"',
    category: 'baby',
    sections: ['Baby Gear', 'Feeding', 'Health'],
  },
};

// 搜尋結果
export interface ForumSearchResult {
  url: string;
  title: string;
  snippet: string;
  forum: ForumType;
}

// 討論串解析結果
export interface ParsedThread {
  threadId: string;
  title: string;
  url: string;
  author: string;
  date: string;
  posts: ParsedPost[];
}

export interface ParsedPost {
  postId: string;
  author: string;
  content: string;
  date: string;
  likes?: number;
  replies?: number;
}
