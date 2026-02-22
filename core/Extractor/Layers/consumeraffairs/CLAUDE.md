# ConsumerAffairs Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | consumeraffairs |
| **平台** | ConsumerAffairs.com |
| **資料類型** | 消費者投訴 + 評價 |
| **來源類型** | review_site |
| **抓取方式** | Playwright |
| **自動化程度** | 70%（投訴資料需人工確認） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **內容傾向** | 偏向負面（投訴導向平台） |
| **評論層級** | 品牌/產品混合 |
| **驗證機制** | 無標準化驗證 |
| **評分制度** | 1-5 星 |
| **特色** | 包含品牌回覆 + 解決狀態 |

---

## 重要注意事項

⚠️ **ConsumerAffairs 偏向負面評價**

- 使用者傾向在遇到問題時才來投訴
- 正面評價比例自然偏低
- 適合用於識別「常見問題」和「危機訊號」
- 不適合用於計算整體滿意度

---

## 搜尋策略

### 搜尋 URL

```
WebSearch: site:consumeraffairs.com "{brand_name}" OR "{product_name}"
```

### 常見 URL 模式

- 品牌頁：`consumeraffairs.com/homeowners/{brand}/`
- 產品頁：`consumeraffairs.com/products/{product}/`

---

## 資料抓取流程

```
1. 讀取 product_queries.txt
        ↓
2. WebSearch 找到對應頁面
        ↓
3. 抓取評論：
   ├── 評分
   ├── 評論標題 + 內容
   ├── 投訴類型（如有）
   ├── 品牌回覆（如有）
   └── 問題是否解決
        ↓
4. 標記為「投訴導向資料」
        ↓
5. 輸出 JSONL
```

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "consumeraffairs",
    "source_type": "review_site",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Dyson vacuum",
    "posts_scraped": 50,
    "relevance_threshold": 0.8
  },
  "product_query": {
    "original_query": "Dyson vacuum",
    "normalized_name": "Dyson V15 Detect",
    "brand": "Dyson",
    "category": "home_appliance"
  },
  "posts": [
    {
      "post_id": "ca_123",
      "platform": "consumeraffairs",
      "post_type": "complaint",
      "author": "Consumer123",
      "content": "The battery died after 6 months...",
      "date": "2026-02-10",
      "url": "https://www.consumeraffairs.com/...",
      "engagement": {
        "helpful_votes": 12
      },
      "sentiment_raw": "1",
      "context": {
        "forum_name": "ConsumerAffairs"
      },
      "language": "en",
      "ai_extracted": {
        "product_mentions": ["Dyson V15"],
        "aspects_mentioned": ["battery_life", "durability"],
        "sentiment_inference": "negative",
        "relevance_to_query": 0.95
      }
    }
  ]
}
```

---

## 萃取協議

| Layer | 動作 |
|-------|------|
| **L1** | Topic Grounding |
| **L2** | 跳過 |
| **L3** | Aspect Extraction（投訴類型分類） |
| **L4** | Aspect Sentiment（預設偏負面） |
| **L5** | Issue Pattern（重點） |
| **L6** | Evidence Summary |

---

## [REVIEW_NEEDED] 觸發條件

1. 品牌/產品在平台上不存在
2. 評論數 < 10 則
3. 正面評價 > 80%（異常，可能為假評）
4. 所有評論集中在短期間

---

## 與電商評論的整合

ConsumerAffairs 資料應標記為「投訴導向」：

```markdown
### ConsumerAffairs 投訴分析

⚠️ **資料來源特性**：ConsumerAffairs 為投訴導向平台，負評比例自然偏高

| 投訴類型 | 數量 | 佔比 |
|---------|------|------|
| 電池問題 | 15 | 30% |
| 吸力下降 | 12 | 24% |
| 客服不佳 | 8 | 16% |
```

---

## 自我審核 Checklist

- [ ] 已標記為「投訴導向平台」
- [ ] 投訴類型正確分類
- [ ] 品牌回覆正確記錄
- [ ] 問題解決狀態正確標記
- [ ] 未將投訴率當作整體負評率
