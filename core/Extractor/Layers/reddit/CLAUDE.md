# Reddit Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | reddit |
| **平台** | Reddit.com |
| **資料類型** | 討論串 + 留言 |
| **來源類型** | social |
| **發現方式** | Reddit API + WebSearch fallback |
| **自動化程度** | 70%（搜尋自動化，相關性過濾需 AI） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **主鍵** | post_id（Reddit post ID） |
| **驗證購買** | 無原生機制，依賴作者自述 |
| **評分制度** | upvotes/downvotes，無星級 |
| **內容結構** | 討論串（OP + comments），非結構化 |
| **時效性** | 舊文可能被編輯或刪除 |

---

## Subreddit 分類對應

根據產品類別，搜尋對應的 subreddit：

| 產品類別 | 主要 Subreddits | 說明 |
|---------|----------------|------|
| beauty | r/SkincareAddiction, r/MakeupAddiction, r/AsianBeauty | 美妝保養討論 |
| health | r/Supplements, r/Fitness, r/nutrition | 健康保健討論 |
| electronics | r/gadgets, r/technology, r/headphones, r/audiophile | 3C 電子討論 |
| toys_games | r/toys, r/boardgames, r/legodeal, r/actionfigures | 玩具遊戲討論 |
| baby | r/beyondthebump, r/BabyBumps, r/Parenting, r/NewParents | 嬰幼兒討論 |
| home_appliance | r/Appliances, r/homeautomation, r/BuyItForLife | 家電討論 |
| food_beverage | r/food, r/Cooking, r/coffee | 食品飲料討論 |
| pet | r/dogs, r/cats, r/Pets | 寵物討論 |
| sports_outdoor | r/CampingGear, r/running, r/Fitness | 戶外運動討論 |
| fashion | r/malefashionadvice, r/femalefashionadvice | 時尚討論 |

---

## 搜尋策略

### 搜尋關鍵字模板

```
"{product_name}" review
"{product_name}" worth it
"{product_name}" problems
"{product_name}" vs
"{product_name}" after 1 year
"{product_name}" recommendation
```

### 搜尋優先級

1. **Reddit API 搜尋**：`/search?q={query}&restrict_sr=true&sort=relevance`
2. **Google site 搜尋**：`site:reddit.com "{product_name}" review`

### 過濾條件

| 條件 | 閾值 | 說明 |
|------|------|------|
| 最小 upvotes | 5 | 過濾低品質內容 |
| 最大年齡 | 2 年 | 保持時效性 |
| 語言 | en | 僅英文 |
| 相關性分數 | ≥ 0.7 | AI 判斷相關性 |

---

## 資料抓取流程

```
1. 讀取 product_queries.txt
        ↓
2. 對每個產品名稱：
   ├── 確定對應 subreddits（依類別）
   ├── Reddit API 搜尋（或 Google site: 搜尋）
   └── 取得討論串 URL 列表
        ↓
3. 對每個討論串：
   ├── 抓取 OP（原始貼文）
   ├── 抓取留言（最多 100 則）
   └── 記錄 engagement（upvotes, replies）
        ↓
4. AI 相關性過濾：
   ├── 確認產品被提及
   ├── 確認是使用心得（非純問題）
   └── 計算相關性分數
        ↓
5. 輸出 JSONL（符合 SocialSourceData 格式）
```

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "reddit",
    "source_type": "social",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Mighty Patch",
    "search_results_count": 50,
    "posts_scraped": 25,
    "relevance_threshold": 0.7
  },
  "product_query": {
    "original_query": "Mighty Patch",
    "normalized_name": "Hero Cosmetics Mighty Patch",
    "brand": "Hero Cosmetics",
    "category": "beauty",
    "matched_asin": "B074PVTPBW"
  },
  "posts": [
    {
      "post_id": "abc123",
      "platform": "reddit",
      "post_type": "thread",
      "author": "skincare_lover",
      "content": "I've been using Mighty Patch for 6 months...",
      "date": "2026-01-15",
      "url": "https://reddit.com/r/SkincareAddiction/comments/abc123",
      "engagement": {
        "upvotes": 245,
        "replies": 42
      },
      "context": {
        "thread_title": "Mighty Patch Review - 6 months later",
        "subreddit": "SkincareAddiction"
      },
      "language": "en",
      "ai_extracted": {
        "product_mentions": ["Mighty Patch Original", "Mighty Patch Invisible"],
        "aspects_mentioned": ["effectiveness", "adhesion", "value"],
        "sentiment_inference": "positive",
        "relevance_to_query": 0.95
      }
    }
  ],
  "aggregated_stats": {
    "total_posts": 25,
    "positive_posts": 18,
    "negative_posts": 3,
    "neutral_posts": 4,
    "mixed_posts": 0,
    "avg_engagement": 85.5,
    "date_range": {
      "earliest": "2025-06-01",
      "latest": "2026-02-20"
    }
  }
}
```

---

## 萃取協議（社群來源版）

社群來源使用修改版的 L1-L6 協議：

| Layer | 電商版 | 社群版 | 說明 |
|-------|--------|--------|------|
| **L1** | Product Grounding | Topic Grounding | 產品查詢資訊，非產品頁面資訊 |
| **L2** | Claim Extraction | **跳過** | 社群來源無官方聲明 |
| **L3** | Aspect Extraction | Aspect Extraction | 相同，從貼文內容萃取 |
| **L4** | Aspect Sentiment | Aspect Sentiment | 相同，使用 AI 推斷 |
| **L5** | Issue Pattern | Issue Pattern | 相同，識別問題模式 |
| **L6** | Evidence Summary | Evidence Summary | 相同，產出摘要 |

### L1: Topic Grounding（社群版）

```markdown
## L1: Topic Grounding

- **search_query**: Mighty Patch
- **normalized_name**: Hero Cosmetics Mighty Patch
- **brand**: Hero Cosmetics
- **category**: beauty
- **matched_asin**: B074PVTPBW
- **data_source**: reddit
- **subreddits_searched**: SkincareAddiction, acne, AsianBeauty
- **posts_analyzed**: 25
- **date_range**: 2025-06-01 ~ 2026-02-20
```

---

## [REVIEW_NEEDED] 觸發條件

1. 找到的相關貼文 < 5 則
2. 平均相關性分數 < 0.7
3. 所有貼文都超過 1 年
4. 與電商評論情感差異 > 0.4
5. 主要 subreddit 搜尋無結果

---

## 自我審核 Checklist

- [ ] 產品名稱正確對應到相關 subreddits
- [ ] 所有貼文都與產品直接相關（非廣告、非 spam）
- [ ] AI 相關性分數合理（抽查 3-5 則）
- [ ] engagement 數據正確（upvotes, replies）
- [ ] 情感推斷合理（正面/負面/中立）
- [ ] 無重複貼文
- [ ] 日期格式正確（YYYY-MM-DD）

---

## Reddit API 設定

### 環境變數

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT="ProductReviewBot/1.0"
```

### API 限制

| 限制 | 值 |
|------|---|
| 請求頻率 | 60 requests/minute |
| 每次搜尋結果 | 最多 100 則 |
| OAuth Token 有效期 | 1 小時 |

### 取得 API 憑證

1. 前往 https://www.reddit.com/prefs/apps
2. 建立 Script App
3. 記錄 Client ID 和 Secret
4. 設定環境變數

---

## 常見問題

### Q: Reddit API 被限流怎麼辦？
A: 實作指數退避，等待後重試。或切換到 Google site: 搜尋 fallback。

### Q: 如何判斷貼文是否與產品相關？
A: 使用 AI 檢查：
1. 產品名稱是否被提及
2. 內容是否為使用心得（而非純問題或廣告）
3. 計算相關性分數

### Q: 如何處理已刪除的貼文？
A: 跳過，記錄在 scrape_meta 中。
