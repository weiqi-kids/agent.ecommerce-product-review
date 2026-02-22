# AVS Forum Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | avsforum |
| **平台** | AVSForum.com |
| **資料類型** | 論壇討論 |
| **來源類型** | forum |
| **產品類別** | 電視、投影機、家庭劇院、AV 擴大機 |
| **抓取方式** | WebFetch |
| **自動化程度** | 60%（討論串需 AI 萃取） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **專業度** | 高（家庭劇院愛好者社群） |
| **評論深度** | 詳細畫質、音效分析 |
| **用戶類型** | 家庭劇院玩家、AV 發燒友 |
| **語言** | 英文 |
| **特色** | Owner's Threads（機主討論串） |

---

## 搜尋策略

### 搜尋關鍵字

```
site:avsforum.com "{product_name}" owner's thread
site:avsforum.com "{product_name}" review
site:avsforum.com "{product_name}" vs
```

### 重要板塊

| 板塊 | 適用產品 |
|------|---------|
| OLED Technology | OLED 電視 |
| LCD Flat Panel | LCD/LED 電視 |
| Projectors | 投影機 |
| Receivers, Amps, and Processors | AV 擴大機 |
| Subwoofers, Speakers | 揚聲器、重低音 |

---

## Owner's Thread 特色

AVS Forum 特有的「機主討論串」：
- 每個電視型號有專屬討論串
- 包含設定分享、問題回報、畫質比較
- 極具參考價值

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "avsforum",
    "source_type": "forum",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "LG C3 OLED",
    "posts_scraped": 50
  },
  "product_query": {
    "original_query": "LG C3 OLED",
    "category": "electronics"
  },
  "posts": [
    {
      "post_id": "avs_789",
      "platform": "avsforum",
      "post_type": "forum_post",
      "author": "HomeTheaterPro",
      "content": "The black levels on this TV are incredible...",
      "date": "2026-01-15",
      "url": "https://www.avsforum.com/threads/...",
      "context": {
        "forum_name": "AVS Forum",
        "forum_section": "OLED Technology",
        "thread_title": "LG C3 Owner's Thread"
      }
    }
  ]
}
```

---

## 萃取重點

AVS Forum 評論常見術語：

| 術語 | 說明 |
|------|------|
| Black levels | 黑階表現 |
| Blooming | 光暈（Mini LED） |
| Motion handling | 動態處理 |
| HDR peak brightness | HDR 峰值亮度 |
| Calibration | 校色 |
| Viewing angle | 可視角度 |

---

## [REVIEW_NEEDED] 觸發條件

1. 找到的討論串 < 3 則
2. 產品非影音類別
3. Owner's Thread 找不到

---

## 自我審核 Checklist

- [ ] 產品為電視/投影/AV 類別
- [ ] 優先使用 Owner's Thread
- [ ] 影音術語正確識別
- [ ] 非商業帖
