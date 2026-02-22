# Slickdeals Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | slickdeals |
| **平台** | Slickdeals.net |
| **資料類型** | 促銷討論 + 評價 |
| **來源類型** | forum |
| **產品類別** | 3C 電子、家電、日用品 |
| **抓取方式** | WebFetch |
| **自動化程度** | 70%（討論串需 AI 萃取） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **內容類型** | 促銷討論 + 產品評價 |
| **評價傾向** | 較為客觀（多數為實際購買者） |
| **投票系統** | 有「這是好 deal」投票 |
| **用戶類型** | 精打細算的消費者 |
| **特色** | 歷史價格追蹤 |

---

## 搜尋策略

### 搜尋關鍵字

```
site:slickdeals.net "{product_name}"
site:slickdeals.net/f/"{product_name}" (論壇帖)
```

### 有價值的資訊

| 資訊 | 說明 |
|------|------|
| 歷史最低價 | 判斷當前價格是否划算 |
| 使用者評價 | 實際購買者的體驗 |
| 產品問題 | 在討論中會被提及 |
| 替代品建議 | 社群推薦 |

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "slickdeals",
    "source_type": "forum",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "AirPods Pro",
    "posts_scraped": 25
  },
  "product_query": {
    "original_query": "AirPods Pro",
    "category": "electronics"
  },
  "posts": [
    {
      "post_id": "sd_456",
      "platform": "slickdeals",
      "post_type": "forum_post",
      "author": "DealHunter99",
      "content": "Got these for $189 last Black Friday, totally worth it...",
      "date": "2026-02-01",
      "url": "https://slickdeals.net/f/...",
      "engagement": {
        "upvotes": 45
      },
      "context": {
        "forum_name": "Slickdeals"
      }
    }
  ]
}
```

---

## 萃取重點

Slickdeals 評論特色：

| 特色 | 說明 |
|------|------|
| 價格比較 | 與其他零售商比較 |
| 歷史價格 | 與過去價格比較 |
| 實際使用 | 購買後的使用心得 |
| 推薦程度 | 是否推薦購買 |

---

## [REVIEW_NEEDED] 觸發條件

1. 產品搜尋結果 < 5 則
2. 所有帖子都是純促銷（無評價內容）
3. 討論超過 1 年

---

## 自我審核 Checklist

- [ ] 帖子包含實際使用心得（非純促銷）
- [ ] 價格資訊正確記錄
- [ ] 投票數正確記錄
- [ ] 非過期促銷帖
