# MakeupAlley Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | makeupalley |
| **平台** | MakeupAlley.com |
| **資料類型** | 美妝產品評價 |
| **來源類型** | review_site |
| **產品類別** | 美妝、保養、香水 |
| **抓取方式** | Playwright（需登入） |
| **自動化程度** | 65%（需維護登入狀態） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **專業度** | 高（美妝愛好者社群） |
| **評論深度** | 包含膚質、使用方式等詳細資訊 |
| **評分系統** | Lippies 評分 + 回購意願 |
| **用戶資料** | 包含膚質、膚色、年齡等 |
| **特色** | 成分分析、過敏警告 |

---

## 搜尋策略

### 搜尋 URL

```
site:makeupalley.com "{product_name}" review
```

### URL 模式

- 產品頁：`makeupalley.com/product/showreview.asp/{product_id}/`
- 品牌頁：`makeupalley.com/brand/{brand_name}/`

---

## 用戶屬性

MakeupAlley 評論包含用戶屬性，可用於分群分析：

| 屬性 | 說明 |
|------|------|
| Skin Type | 膚質（Oily/Dry/Combination/Normal） |
| Skin Tone | 膚色（Light/Medium/Dark） |
| Age | 年齡範圍 |
| Hair Color | 髮色 |
| Eye Color | 眼睛顏色 |

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "makeupalley",
    "source_type": "review_site",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Mighty Patch",
    "posts_scraped": 80
  },
  "product_query": {
    "original_query": "Mighty Patch",
    "normalized_name": "Hero Cosmetics Mighty Patch Original",
    "brand": "Hero Cosmetics",
    "category": "beauty"
  },
  "posts": [
    {
      "post_id": "mua_789",
      "platform": "makeupalley",
      "post_type": "review",
      "author": "BeautyLover123",
      "author_verified": false,
      "content": "Works great on my oily, acne-prone skin...",
      "date": "2026-01-25",
      "url": "https://www.makeupalley.com/product/...",
      "engagement": {
        "helpful_votes": 25
      },
      "sentiment_raw": "4.5",
      "context": {
        "forum_name": "MakeupAlley"
      },
      "ai_extracted": {
        "product_mentions": ["Mighty Patch Original"],
        "aspects_mentioned": ["effectiveness", "adhesion", "value"],
        "sentiment_inference": "positive",
        "relevance_to_query": 0.95
      }
    }
  ]
}
```

---

## 萃取重點

MakeupAlley 評論特色：

| 欄位 | 說明 |
|------|------|
| Lippies Rating | 平台專屬評分 |
| Would Repurchase | 回購意願（關鍵指標） |
| Package Quality | 包裝品質 |
| Effectiveness | 效果 |
| Scent | 氣味 |

---

## [REVIEW_NEEDED] 觸發條件

1. 產品在平台上不存在
2. 評論數 < 10 則
3. 產品非美妝保養類
4. 所有評論超過 2 年

---

## 自我審核 Checklist

- [ ] 產品為美妝保養類別
- [ ] 用戶膚質資訊正確記錄
- [ ] 回購意願正確標記
- [ ] 評分正確記錄
- [ ] 非廣告帖
