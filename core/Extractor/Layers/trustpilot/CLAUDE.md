# Trustpilot Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | trustpilot |
| **平台** | Trustpilot.com |
| **資料類型** | 品牌評價 |
| **來源類型** | review_site |
| **抓取方式** | Playwright |
| **自動化程度** | 75%（爬蟲自動化，品牌對應需維護） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **評論層級** | 品牌級，非產品級 |
| **主鍵** | 品牌 slug（如 `hero-cosmetics.com`） |
| **驗證購買** | ✅ 有驗證機制 |
| **評分制度** | 1-5 星 |
| **信任分數** | TrustScore（整體信任度） |

---

## 重要限制

⚠️ **Trustpilot 評論是品牌級而非產品級**

- 評論針對「公司/品牌」，而非特定產品
- 適合評估：客服品質、物流體驗、退換貨政策
- 不適合評估：特定產品功能、效果

---

## 搜尋策略

### 品牌 → Trustpilot URL 對應

| 品牌 | Trustpilot URL |
|------|---------------|
| Hero Cosmetics | trustpilot.com/review/hero-cosmetics.com |
| Apple | trustpilot.com/review/apple.com |
| Sony | trustpilot.com/review/sony.com |

### 發現新品牌

```
WebSearch: site:trustpilot.com "{brand_name}"
```

---

## 資料抓取流程

```
1. 讀取 brand_queries.txt
        ↓
2. 對每個品牌：
   ├── 查詢 Trustpilot URL
   ├── 抓取品牌頁面（TrustScore, 總評論數）
   └── 抓取最新 100 則評論
        ↓
3. 解析評論：
   ├── 評分（1-5 星）
   ├── 評論文字
   ├── 是否驗證購買
   └── 回覆狀態（品牌是否有回覆）
        ↓
4. 輸出 JSONL
```

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "trustpilot",
    "source_type": "review_site",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Hero Cosmetics",
    "search_results_count": 1,
    "posts_scraped": 100,
    "relevance_threshold": 1.0
  },
  "product_query": {
    "original_query": "Hero Cosmetics",
    "normalized_name": "Hero Cosmetics",
    "brand": "Hero Cosmetics",
    "category": "beauty"
  },
  "posts": [
    {
      "post_id": "tp_abc123",
      "platform": "trustpilot",
      "post_type": "review",
      "author": "John D.",
      "author_verified": true,
      "content": "Great customer service...",
      "date": "2026-02-15",
      "url": "https://www.trustpilot.com/reviews/abc123",
      "engagement": {
        "helpful_votes": 5
      },
      "sentiment_raw": "5",
      "context": {
        "forum_name": "Trustpilot"
      },
      "language": "en"
    }
  ],
  "aggregated_stats": {
    "total_posts": 100,
    "positive_posts": 75,
    "negative_posts": 15,
    "neutral_posts": 10
  }
}
```

---

## 萃取協議

| Layer | 動作 |
|-------|------|
| **L1** | Brand Grounding（品牌資訊 + TrustScore） |
| **L2** | 跳過（無官方聲明） |
| **L3** | Aspect Extraction（客服、物流、品質） |
| **L4** | Aspect Sentiment |
| **L5** | Issue Pattern |
| **L6** | Evidence Summary |

---

## [REVIEW_NEEDED] 觸發條件

1. 品牌在 Trustpilot 上不存在
2. 評論數 < 20 則
3. TrustScore < 2.0（可能為問題品牌）
4. 評論日期全部超過 1 年

---

## 自我審核 Checklist

- [ ] 品牌 URL 正確對應
- [ ] TrustScore 正確記錄
- [ ] 驗證購買正確標記
- [ ] 評分分佈合理
- [ ] 無重複評論
