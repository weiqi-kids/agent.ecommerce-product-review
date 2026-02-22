/**
 * Reddit Scraper - 類型定義
 */

// Reddit API 回應類型
export interface RedditListing<T> {
  kind: 'Listing';
  data: {
    after: string | null;
    before: string | null;
    children: Array<{ kind: string; data: T }>;
  };
}

export interface RedditPost {
  id: string;
  name: string; // fullname: t3_xxx
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  subreddit_prefixed: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  url: string;
  is_self: boolean;
  over_18: boolean;
  spoiler: boolean;
  stickied: boolean;
  archived: boolean;
  locked: boolean;
}

export interface RedditComment {
  id: string;
  name: string; // fullname: t1_xxx
  body: string;
  author: string;
  score: number;
  created_utc: number;
  parent_id: string;
  link_id: string;
  is_submitter: boolean;
  depth: number;
  replies?: RedditListing<RedditComment> | '';
}

// Scraper 選項
export interface RedditScraperOptions {
  query: string;
  output: string;
  maxPosts?: number;
  subreddits?: string[];
  relevanceThreshold?: number;
  useApi?: boolean;
  sortBy?: 'relevance' | 'hot' | 'top' | 'new';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

// OAuth Token
export interface RedditOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at?: number;
}

// 搜尋結果
export interface SearchResult {
  postId: string;
  title: string;
  url: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdAt: Date;
  author: string;
}

// Subreddit 分類對應
export const CATEGORY_SUBREDDITS: Record<string, string[]> = {
  beauty: ['SkincareAddiction', 'MakeupAddiction', 'AsianBeauty', 'acne', 'beauty'],
  health: ['Supplements', 'Fitness', 'nutrition', 'HealthyFood', 'loseit'],
  electronics: ['gadgets', 'technology', 'headphones', 'audiophile', 'BudgetAudiophile', 'hometheater'],
  toys_games: ['toys', 'boardgames', 'legodeal', 'actionfigures', 'Lego', 'pokemon'],
  baby: ['beyondthebump', 'BabyBumps', 'Parenting', 'NewParents', 'Mommit', 'daddit'],
  home_appliance: ['Appliances', 'homeautomation', 'BuyItForLife', 'homeowners'],
  food_beverage: ['food', 'Cooking', 'coffee', 'tea', 'Baking'],
  pet: ['dogs', 'cats', 'Pets', 'puppy101', 'CatAdvice'],
  sports_outdoor: ['CampingGear', 'running', 'Fitness', 'hiking', 'bicycling'],
  fashion: ['malefashionadvice', 'femalefashionadvice', 'streetwear', 'frugalmalefashion'],
  automotive: ['cars', 'MechanicAdvice', 'AutoDetailing', 'Cartalk'],
  other: ['BuyItForLife', 'reviews', 'ProductPorn'],
};

// 搜尋關鍵字模板
export const SEARCH_TEMPLATES = [
  '"{query}" review',
  '"{query}" worth it',
  '"{query}" problems',
  '"{query}" after 1 year',
  '"{query}" recommendation',
];
