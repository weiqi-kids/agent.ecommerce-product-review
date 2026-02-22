# Head-Fi Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | headfi |
| **平台** | Head-Fi.org |
| **資料類型** | 論壇討論 |
| **來源類型** | forum |
| **產品類別** | 耳機、音響、DAC、擴大機 |
| **抓取方式** | WebFetch |
| **自動化程度** | 60%（討論串需 AI 萃取） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **專業度** | 極高（發燒友社群） |
| **評論深度** | 詳細技術分析 |
| **用戶類型** | 音響發燒友、專業評測者 |
| **語言** | 英文為主 |
| **主要板塊** | Headphones, Portable Audio, High-end Audio |

---

## 搜尋策略

### 搜尋關鍵字

```
site:head-fi.org "{product_name}" review
site:head-fi.org "{product_name}" impressions
site:head-fi.org "{product_name}" vs
```

### 重要板塊

| 板塊 | URL 路徑 | 適用產品 |
|------|---------|---------|
| Headphones | /forums/headphones-full-size/ | 全罩式耳機 |
| Portable | /forums/portable-headphones-earphones-and-in-ear-monitors/ | 入耳式耳機 |
| Amps | /forums/headphone-amps-full-size/ | 耳機擴大機 |

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "headfi",
    "source_type": "forum",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Sony WH-1000XM5",
    "posts_scraped": 30
  },
  "product_query": {
    "original_query": "Sony WH-1000XM5",
    "category": "electronics"
  },
  "posts": [
    {
      "post_id": "hf_123456",
      "platform": "headfi",
      "post_type": "forum_post",
      "author": "AudioEnthusiast",
      "content": "The soundstage on these is impressive...",
      "date": "2026-01-20",
      "url": "https://www.head-fi.org/threads/...",
      "context": {
        "forum_name": "Head-Fi",
        "forum_section": "Headphones"
      }
    }
  ]
}
```

---

## 萃取重點

Head-Fi 評論通常包含專業音響術語：

| 術語 | 說明 |
|------|------|
| Soundstage | 聲場寬度 |
| Imaging | 定位準確度 |
| Treble/Mid/Bass | 高中低頻 |
| Sibilance | 齒音 |
| Detail retrieval | 細節還原 |
| Burn-in | 煲機 |

---

## [REVIEW_NEEDED] 觸發條件

1. 找到的討論串 < 3 則
2. 所有討論超過 2 年
3. 產品非音響類別

---

## 自我審核 Checklist

- [ ] 產品為音響相關類別
- [ ] 討論串來自 Head-Fi 官方論壇
- [ ] 音響術語正確識別
- [ ] 非廣告/團購帖
