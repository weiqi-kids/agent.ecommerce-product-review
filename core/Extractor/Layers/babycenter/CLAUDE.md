# BabyCenter Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | babycenter |
| **平台** | BabyCenter.com |
| **資料類型** | 父母討論 |
| **來源類型** | forum |
| **產品類別** | 嬰幼兒用品、孕婦用品 |
| **抓取方式** | WebFetch |
| **自動化程度** | 65%（討論串需 AI 萃取） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **用戶類型** | 新手父母、準父母 |
| **內容風格** | 經驗分享、建議諮詢 |
| **評論傾向** | 較為溫和，注重安全 |
| **語言** | 英文為主 |
| **特色** | 依寶寶年齡分群 |

---

## 搜尋策略

### 搜尋關鍵字

```
site:community.babycenter.com "{product_name}"
site:babycenter.com "{product_name}" review
```

### 重要社群

| 社群 | 適用產品 |
|------|---------|
| Birth Clubs | 依出生月份分群的社群 |
| Baby Gear | 嬰兒用品討論 |
| Breastfeeding | 母乳相關產品 |
| Formula Feeding | 配方奶相關產品 |

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "babycenter",
    "source_type": "forum",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Pampers Swaddlers",
    "posts_scraped": 40
  },
  "product_query": {
    "original_query": "Pampers Swaddlers",
    "normalized_name": "Pampers Swaddlers Diapers",
    "brand": "Pampers",
    "category": "baby"
  },
  "posts": [
    {
      "post_id": "bc_123",
      "platform": "babycenter",
      "post_type": "forum_post",
      "author": "NewMom2026",
      "content": "We've been using Pampers Swaddlers since birth and love them...",
      "date": "2026-02-10",
      "url": "https://community.babycenter.com/...",
      "engagement": {
        "replies": 15,
        "likes": 8
      },
      "context": {
        "forum_name": "BabyCenter",
        "forum_section": "Baby Gear"
      }
    }
  ]
}
```

---

## 萃取重點

BabyCenter 評論常見主題：

| 主題 | 說明 |
|------|------|
| 安全性 | 對嬰兒的安全考量 |
| 過敏反應 | 皮膚過敏等問題 |
| 尺寸合適度 | 尿布、衣物等 |
| 耐用度 | 嬰兒推車、汽座等 |
| 性價比 | 價格與效果比較 |

---

## 安全性標記

嬰幼兒產品需特別注意安全議題：

```json
{
  "safety_concerns": [
    {
      "issue": "窒息風險",
      "mentions": 3,
      "severity": "high"
    },
    {
      "issue": "皮膚過敏",
      "mentions": 8,
      "severity": "medium"
    }
  ]
}
```

---

## [REVIEW_NEEDED] 觸發條件

1. 產品討論 < 5 則
2. 產品非嬰幼兒類別
3. 發現安全性問題 > 10%
4. 所有討論超過 2 年

---

## 自我審核 Checklist

- [ ] 產品為嬰幼兒類別
- [ ] 安全性問題正確標記
- [ ] 過敏反應正確記錄
- [ ] 討論來自實際父母（非廣告）
- [ ] 依年齡適用性正確分類
