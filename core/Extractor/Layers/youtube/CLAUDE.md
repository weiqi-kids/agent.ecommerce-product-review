# YouTube Layer

## Layer 定義

| 項目 | 值 |
|------|---|
| **Layer 名稱** | youtube |
| **平台** | YouTube.com |
| **資料類型** | 影片留言 + 影片資訊 |
| **來源類型** | social |
| **抓取工具** | yt-dlp |
| **自動化程度** | 85%（搜尋 + 留言抓取自動化） |

---

## 平台特性

| 特性 | 說明 |
|------|------|
| **主鍵** | video_id（11 字元） |
| **驗證購買** | 無，但可標記贊助影片 |
| **評分制度** | likes/dislikes（dislikes 已隱藏），留言無評分 |
| **內容結構** | 影片 + 留言（可分頁） |
| **時效性** | 影片可能被刪除或設為私有 |

---

## yt-dlp 使用方式

### 安裝

```bash
# macOS
brew install yt-dlp

# 或透過 pip
pip install yt-dlp
```

### 搜尋影片

```bash
# 搜尋前 20 個相關影片
yt-dlp --flat-playlist --print "%(id)s %(title)s" "ytsearch20:{query} review"

# 取得 JSON 格式
yt-dlp --flat-playlist -j "ytsearch20:{query} review"
```

### 取得影片資訊

```bash
# 完整資訊（JSON）
yt-dlp --dump-json --skip-download "https://www.youtube.com/watch?v={video_id}"
```

### 取得留言

```bash
# 下載留言（JSON）
yt-dlp --write-comments --skip-download -o "%(id)s" "https://www.youtube.com/watch?v={video_id}"

# 留言會存在 {video_id}.info.json 的 comments 欄位
```

---

## 影片類型過濾

僅抓取以下類型影片：

| 類型 | 判斷方式 | 說明 |
|------|---------|------|
| 評測影片 | 標題含 "review", "評測", "開箱" | 核心內容 |
| 比較影片 | 標題含 "vs", "comparison", "對比" | 競品分析 |
| 使用心得 | 標題含 "after X months/years", "長期使用" | 長期體驗 |
| 問題反饋 | 標題含 "problems", "issues", "問題" | 負面資訊 |

### 排除類型

| 類型 | 判斷方式 | 原因 |
|------|---------|------|
| 廣告影片 | 標題含 "#ad", "#sponsored", "贊助" | 利益衝突 |
| 開箱短片 | 時長 < 3 分鐘 | 深度不足 |
| 純娛樂 | 類別 = Entertainment 且無 review 關鍵字 | 非評測 |

---

## 資料抓取流程

```
1. 讀取 product_queries.txt
        ↓
2. 對每個產品名稱：
   ├── yt-dlp --flat-playlist 搜尋影片
   ├── 過濾影片類型（評測/比較/心得）
   └── 取得影片 ID 列表
        ↓
3. 對每個影片：
   ├── yt-dlp --dump-json 取得影片資訊
   ├── yt-dlp --write-comments 取得留言
   └── 解析 JSON 提取所需欄位
        ↓
4. 標記贊助內容：
   ├── 檢查標題/描述是否含贊助聲明
   ├── 檢查 YouTube 的「包含付費宣傳內容」標記
   └── 設定 is_sponsored flag
        ↓
5. 輸出 JSONL（符合 SocialSourceData 格式）
```

---

## JSONL 輸出格式

```json
{
  "scrape_meta": {
    "platform": "youtube",
    "source_type": "social",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "AirPods Pro review",
    "search_results_count": 20,
    "posts_scraped": 150,
    "relevance_threshold": 0.7
  },
  "product_query": {
    "original_query": "AirPods Pro",
    "normalized_name": "Apple AirPods Pro 2nd Gen",
    "brand": "Apple",
    "category": "electronics",
    "matched_asin": "B0CHWRXH8B"
  },
  "posts": [
    {
      "post_id": "dQw4w9WgXcQ_c1",
      "platform": "youtube",
      "post_type": "video_comment",
      "author": "TechReviewer123",
      "content": "I've been using AirPods Pro for 6 months and the noise cancellation is amazing...",
      "date": "2026-01-15",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "engagement": {
        "likes": 245,
        "replies": 12
      },
      "context": {
        "video_id": "dQw4w9WgXcQ",
        "video_title": "AirPods Pro 2 - 6 Month Review",
        "channel_name": "TechGuru"
      },
      "language": "en",
      "ai_extracted": {
        "product_mentions": ["AirPods Pro", "AirPods Pro 2"],
        "aspects_mentioned": ["noise_cancellation", "battery_life", "comfort"],
        "sentiment_inference": "positive",
        "relevance_to_query": 0.95,
        "is_sponsored": false
      }
    }
  ],
  "aggregated_stats": {
    "total_posts": 150,
    "positive_posts": 95,
    "negative_posts": 20,
    "neutral_posts": 30,
    "mixed_posts": 5,
    "avg_engagement": 45.2,
    "date_range": {
      "earliest": "2025-06-01",
      "latest": "2026-02-20"
    }
  }
}
```

---

## 萃取協議（社群來源版）

| Layer | 動作 | 說明 |
|-------|------|------|
| **L1** | Topic Grounding | 影片搜尋資訊 + 頻道資訊 |
| **L2** | **跳過** | 社群來源無官方聲明 |
| **L3** | Aspect Extraction | 從留言萃取 |
| **L4** | Aspect Sentiment | AI 推斷情感 |
| **L5** | Issue Pattern | 識別問題模式 |
| **L6** | Evidence Summary | 產出摘要 |

### L1: Topic Grounding（YouTube 版）

```markdown
## L1: Topic Grounding

- **search_query**: AirPods Pro review
- **videos_analyzed**: 15
- **total_comments**: 450
- **top_channels**:
  - TechGuru (2.5M subscribers)
  - MKBHD (18M subscribers)
  - iJustine (7M subscribers)
- **sponsored_videos**: 3/15 (20%)
- **date_range**: 2025-06-01 ~ 2026-02-20
```

---

## [REVIEW_NEEDED] 觸發條件

1. 找到的相關影片 < 5 部
2. 總留言數 < 50 則
3. 超過 50% 為贊助影片
4. 所有影片都超過 1 年
5. 與電商評論情感差異 > 0.4

---

## 自我審核 Checklist

- [ ] 影片類型正確（評測/比較/心得）
- [ ] 贊助內容正確標記
- [ ] 留言與影片主題相關
- [ ] 頻道訂閱數正確記錄
- [ ] 影片時長 > 3 分鐘
- [ ] 無重複留言
- [ ] 日期格式正確（YYYY-MM-DD）

---

## yt-dlp 輸出欄位對應

| yt-dlp 欄位 | 用途 |
|------------|------|
| `id` | video_id |
| `title` | 影片標題 |
| `description` | 影片描述（檢查贊助聲明） |
| `channel` | 頻道名稱 |
| `channel_follower_count` | 訂閱數 |
| `view_count` | 觀看次數 |
| `like_count` | 按讚數 |
| `duration` | 影片時長（秒） |
| `upload_date` | 上傳日期 |
| `comments` | 留言陣列 |
| `is_paid_promotion` | 付費宣傳標記 |

### 留言欄位

| 欄位 | 說明 |
|------|------|
| `id` | 留言 ID |
| `text` | 留言內容 |
| `author` | 作者名稱 |
| `author_is_verified` | 是否認證頻道 |
| `like_count` | 按讚數 |
| `timestamp` | 時間戳 |
| `parent` | 父留言 ID（回覆用） |

---

## 常見問題

### Q: yt-dlp 被 YouTube 限流怎麼辦？
A: 實作指數退避，或使用代理輪換。

### Q: 如何判斷影片是否為贊助？
A: 檢查以下項目：
1. YouTube 的 `is_paid_promotion` 欄位
2. 標題/描述含 "#ad", "#sponsored"
3. 描述含 "本影片由 XX 贊助"

### Q: 如何處理私有或刪除的影片？
A: 跳過，記錄在 scrape_meta 中。

### Q: 留言太多怎麼辦？
A: 使用 `--max-comments` 限制，優先抓取高讚數留言。
