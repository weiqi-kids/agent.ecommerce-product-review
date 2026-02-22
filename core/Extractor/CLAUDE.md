# Extractor 角色定義 — L1-L6 萃取協議

## 職責

Extractor 負責從電商平台擷取商品評論資料，並透過 L1-L6 六層萃取協議將原始 JSONL 轉化為結構化 Markdown 文件。

## L1-L6 萃取協議

### L1: Product Grounding（商品定錨）

**輸入**：原始 JSONL 行
**輸出**：商品基本資訊

提取以下欄位：
- `product_id`（ASIN 或 UPC/EAN）
- `upc`/`ean`
- `asin`
- `sku`（Best Buy SKU）
- `walmart_id`（Walmart Product ID）
- `brand`
- `title`（商品標題）
- `image_url`（商品主圖 URL）
- `platform`（來源平台，單一來源時）
- `store_id` / `store_name`
- `category`（從品類 enum 中選擇）
- `language`
- `price` / `currency`
- `avg_rating` / `total_count`
- `source_url`
- `fetched_at`
- `reviews_analyzed`（本批次分析的評論數）

**多來源支援**（當聚合多平台評論時）：
- `sources`：各來源統計列表
  ```json
  {
    "sources": [
      { "platform": "amazon_us", "review_count": 15, "avg_rating": 4.2 },
      { "platform": "walmart_us", "review_count": 45, "avg_rating": 4.5 },
      { "platform": "bestbuy_us", "review_count": 30, "avg_rating": 4.3 }
    ],
    "total_reviews": 90,
    "match_method": "upc",
    "match_confidence": "high"
  }
  ```

**分批行為**：僅 batch_index = 1 時執行。

### L2: Claim Extraction（聲明提取）

**輸入**：L1 + 商品描述（description, bullet_points）
**輸出**：行銷聲明列表

從商品描述中提取所有可驗證的聲明：
- `claim_text`：聲明原文
- `source_field`：來源欄位（title / description / bullet_points）
- `type`：聲明類型
  - `performance`（性能宣稱）
  - `material`（材質宣稱）
  - `certification`（認證宣稱）
  - `comparison`（比較宣稱）
  - `durability`（耐用性宣稱）
  - `health_safety`（健康安全宣稱）

**分批行為**：僅 batch_index = 1 時執行。

### L3: Aspect Extraction（面向提取）

**輸入**：L1 + 評論文字（reviews[].body）
**輸出**：體驗面向列表

從評論中識別使用者討論的面向：
- `aspect`：面向名稱（英文，用於跨平台合併）
- `category`：面向分類
  - `performance`（性能）
  - `design`（設計）
  - `durability`（耐用）
  - `usability`（易用）
  - `value`（性價比）
  - `packaging`（包裝）
  - `customer_service`（客服）
  - `compatibility`（相容性）
- `mentions`：提及次數
- `by_source`：按來源分佈（多來源時）
  ```json
  {
    "aspect": "battery_life",
    "mentions": 25,
    "by_source": {
      "amazon_us": 8,
      "walmart_us": 12,
      "bestbuy_us": 5
    }
  }
  ```

**分批行為**：每批獨立執行，最後合併加總 mentions。

### L4: Aspect Sentiment（面向情感）

**輸入**：L3 + 評論文字
**輸出**：面向情感分析

對每個面向進行情感評分：
- `aspect`：面向名稱
- `sentiment`：`positive` / `negative` / `mixed`
- `score`：0.0-1.0（0=極負面，1=極正面）
- `evidence`：代表性引述列表（保留原文語言）
  - `quote`：引述文字
  - `count`：持相似觀點的評論數
  - `source`：來源平台（多來源時）
- `score_by_source`：各來源情感分數（多來源時）
  ```json
  {
    "aspect": "noise_cancellation",
    "score": 0.85,
    "score_by_source": {
      "amazon_us": 0.82,
      "walmart_us": 0.88,
      "bestbuy_us": 0.85
    }
  }
  ```

**分批行為**：每批獨立執行，合併時重新計算加權平均 score。

### L5: Issue Pattern（問題模式）

**輸入**：L4 + 評論語料
**輸出**：問題模式識別

識別反覆出現的問題：
- `issue`：問題描述（英文）
- `frequency`：出現頻率（n/total, percentage）
- `severity`：`low` / `medium` / `high`
  - `low`：不影響主要功能
  - `medium`：影響使用體驗
  - `high`：影響產品核心功能或安全
- `quotes`：代表性引述（保留原文語言）
  - `quote`：引述文字
  - `source`：來源平台（多來源時）
- `frequency_by_source`：各來源問題頻率（多來源時）
  ```json
  {
    "issue": "battery_drains_quickly",
    "frequency": "15/90 (17%)",
    "frequency_by_source": {
      "amazon_us": "3/15 (20%)",
      "walmart_us": "8/45 (18%)",
      "bestbuy_us": "4/30 (13%)"
    }
  }
  ```

**分批行為**：每批獨立執行，合併時重新計算 frequency。

### L6: Evidence Summary（證據摘要）

**輸入**：L1-L5 綜合
**輸出**：結構化摘要

基於前五層的結果產出：
- **Strengths**：優勢列表（含百分比、mentions 數、描述）
- **Weaknesses**：劣勢列表（含百分比、描述）
- **Claim vs. Reality**：聲明驗證表（每個 L2 聲明對應 L3-L5 證據）
  - Verdict：`Supported` / `Partial` / `Contradicted` / `Unverifiable`

**分批行為**：合併步驟完成後生成（基於合併後的 L1-L5 資料）。

## 品類 Enum（共用）

**嚴格限制：category 只能使用以下值，不可自行新增。**

| Key | 中文 | 判定條件 |
|-----|------|----------|
| `electronics` | 電子產品 | 手機、耳機、電腦、相機、遊戲主機等 |
| `home_appliance` | 家電 | 冰箱、洗衣機、吸塵器、空調等 |
| `beauty` | 美妝保養 | 護膚品、化妝品、香水等 |
| `health` | 健康保健 | 保健食品、醫療器材、健身器材等 |
| `toys_games` | 玩具遊戲 | 兒童玩具、桌遊、模型等 |
| `sports_outdoor` | 運動戶外 | 運動裝備、露營用品、自行車等 |
| `fashion` | 時尚服飾 | 服裝、鞋子、包包、飾品等 |
| `food_beverage` | 食品飲料 | 食品、飲料、調味料等 |
| `pet` | 寵物用品 | 寵物食品、玩具、護理用品等 |
| `baby` | 嬰幼兒 | 嬰兒用品、童裝、推車等 |
| `automotive` | 汽車用品 | 車用配件、清潔用品、工具等 |
| `other` | 其他 | 無法歸入以上分類 |

> 需要新增 category 時必須與使用者確認後寫入本文件。

## 萃取輸出 .md 模板

```markdown
# {canonical_title}

[REVIEW_NEEDED]  <!-- 僅觸發時加入 -->

## L1: Product Grounding

![{product_title}]({image_url})

| Field | Value |
|---|---|
| **product_id** | {ASIN or UPC} |
| **UPC/EAN** | {upc} |
| **ASIN** | {asin} |
| **SKU** | {sku} |
| **Walmart ID** | {walmart_id} |
| **Brand** | {brand} |
| **Platform** | {layer_name} |
| **Store** | {store_name} ({store_id}) |
| **Category** | {category} |
| **Language** | {lang} |
| **Price** | {price} {currency} |
| **Avg Rating** | {avg_rating} ({total_count} ratings) |
| **Source URL** | {url} |
| **Fetched At** | {timestamp} |
| **Reviews Analyzed** | {count} |

### Sources (Multi-Source Only)

<!-- 僅多來源聚合時顯示 -->

| Platform | Reviews | Avg Rating | Match Method |
|---|---|---|---|
| amazon_us | {n} | {rating} | {upc/name_search} |
| walmart_us | {n} | {rating} | {upc/name_search} |
| bestbuy_us | {n} | {rating} | {upc/name_search} |
| **Total** | **{total}** | **{weighted_avg}** | Confidence: {high/medium/low} |

## L2: Claim Extraction

| # | Claim | Source | Type |
|---|---|---|---|
| 1 | "{claim_text}" | {source_field} | {type} |

## L3: Aspect Extraction

| Aspect | Category | Mentions | By Source |
|---|---|---|---|
| {aspect_key} | {aspect_category} | {count} | A:{n} W:{n} B:{n} |

<!-- By Source 欄位僅多來源時顯示，格式為 A:Amazon W:Walmart B:BestBuy -->

## L4: Aspect Sentiment

| Aspect | Sentiment | Score | By Source | Key Evidence |
|---|---|---|---|---|
| {aspect} | {pos/neg/mixed} | {0.0-1.0} | A:{s} W:{s} B:{s} | "{quote}" (x{n}) |

<!-- By Source 欄位僅多來源時顯示，顯示各來源的情感分數 -->

## L5: Issue Patterns

| Issue | Frequency | Severity | By Source | Representative Quotes |
|---|---|---|---|---|
| {issue_key} | {n}/{total} ({pct}%) | {low/med/high} | A:{n} W:{n} B:{n} | "{quote}" |

<!-- By Source 欄位僅多來源時顯示，顯示各來源的問題頻率 -->

## L6: Evidence-Based Summary

### Strengths
1. **{aspect}** ({pct}% positive, {n} mentions): {description}

### Weaknesses
1. **{issue}** ({pct}% report): {description}

### Claim vs. Reality
| Claim | Verdict | Evidence |
|---|---|---|
| "{claim}" | {Supported/Partial/Contradicted} | {evidence_summary} |

---
*Generated: {date} | Source: {layer} | Reviews: {count} | Confidence: {high/medium/low}*
```

## Batch .md 模板（batch_index > 1）

batch_index > 1 時，只包含 L3-L5：

```markdown
# {canonical_title} — Batch {N}/{total}

## L3: Aspect Extraction

| Aspect | Category | Mentions |
|---|---|---|
| ... | ... | ... |

## L4: Aspect Sentiment

| Aspect | Sentiment | Score | Key Evidence |
|---|---|---|---|
| ... | ... | ... | ... |

## L5: Issue Patterns

| Issue | Frequency | Severity | Representative Quotes |
|---|---|---|---|
| ... | ... | ... | ... |

---
*Batch {N}/{total} | Reviews in batch: {count}*
```

## 通用萃取規則

1. **aspect 名稱統一用英文**（跨平台合併用），引述保留原文語言
2. **score 計算**：基於該批次評論的正面/負面比例，0.0-1.0
3. **frequency 計算**：出現該問題的評論數 / 該批次總評論數
4. **severity 判定**：
   - `high`：影響產品核心功能或安全（如電池爆炸、過敏反應）
   - `medium`：影響使用體驗（如續航短、噪音大）
   - `low`：不影響主要功能（如包裝不精美、顏色與圖片略有差異）
5. **多來源合併**：
   - 評論 ID 格式：`{platform}:{original_id}`（例：`walmart_us:R123456`）
   - 引述標註來源：`"Great product" (Amazon)` 或 `"Excellent quality" (Walmart)`
   - 各來源評論數需達 5 則以上才納入統計

## JSONL 行結構

每行一個 JSON 物件：

```json
{
  "scrape_meta": {
    "platform": "amazon_us",
    "scraped_at": "2026-01-27T10:00:00Z",
    "source_url": "https://www.amazon.com/dp/B09V3KXJPB",
    "locale": "en-US",
    "batch_index": 1,
    "batch_total": 4,
    "total_reviews_scraped": 200
  },
  "product": {
    "asin": "B09V3KXJPB",
    "upc": "",
    "title": "Product Title...",
    "brand": "Brand",
    "price": {"amount": 249.00, "currency": "USD"},
    "category_breadcrumb": ["Electronics", "Headphones"],
    "description": "...",
    "bullet_points": ["...", "..."],
    "seller": {
      "store_id": "amzn-direct",
      "store_name": "Amazon.com",
      "is_official": true
    }
  },
  "rating_summary": {
    "average": 4.7,
    "total_count": 87432,
    "distribution": {"5": 65210, "4": 12100, "3": 5200, "2": 2800, "1": 2122}
  },
  "reviews": [
    {
      "review_id": "R3ABC123",
      "rating": 5,
      "title": "Best earbuds",
      "body": "The noise cancellation is incredible...",
      "date": "2026-01-15",
      "verified_purchase": true,
      "helpful_votes": 42,
      "language": "en"
    }
  ]
}
```

## 自我審核 Checklist（萃取通用）

萃取完成後，子代理必須逐項確認：

- [ ] product_id 正確提取（ASIN 或 UPC/EAN/SKU）
- [ ] category 使用 enum 定義值
- [ ] aspect 名稱使用英文
- [ ] score 在 0.0-1.0 範圍內
- [ ] frequency 分母為本批次評論總數
- [ ] severity 判定符合定義
- [ ] 引述保留原文語言
- [ ] 未自行擴大 REVIEW_NEEDED 判定範圍
- [ ] 未產生無來源的聲明
- [ ] batch_index > 1 時未執行 L1-L2

**多來源額外檢查**（僅適用於聚合多平台資料時）：

- [ ] 各來源評論 ID 格式正確（`{platform}:{id}`）
- [ ] 引述標註來源平台
- [ ] by_source 欄位數據一致（加總等於 total）
- [ ] match_confidence 反映實際匹配方式（UPC=high, name=low）
- [ ] 各來源至少 5 則評論才納入統計

## [REVIEW_NEEDED] 觸發規則

### 單一來源

1. 評論數 < 10 則
2. 商品標題與 registry 不符 >30%
3. 偵測到語言不符
4. 聲明驗證發現直接矛盾
5. 情感分數異常（同商品跨平台差異 >0.5）
6. 價格異常（同商品跨店家差異 >50%）

### 多來源聚合

1. **所有來源加總** < 20 則（取代單一來源 < 10）
2. 僅單一來源有效（其他來源搜尋失敗）
3. match_confidence = low 且缺乏 UPC 驗證
4. 各來源情感分數差異 > 0.3（可能匹配到不同產品）

---

## 社群來源萃取協議（Social Source Protocol）

社群來源（Reddit、YouTube、論壇等）使用修改版的 L1-L6 協議。

### 適用平台

| 平台 | 類型 | 特性 |
|------|------|------|
| Reddit | social | 討論串 + 留言，無驗證購買 |
| YouTube | social | 影片留言，可標記贊助內容 |
| Trustpilot | review_site | 品牌級評價，有驗證購買 |
| ConsumerAffairs | review_site | 投訴導向，負評偏高 |
| Head-Fi | forum | 音響專業論壇 |
| AVS Forum | forum | 家庭劇院專業論壇 |
| Slickdeals | forum | 促銷 + 評價 |
| MakeupAlley | review_site | 美妝評價，含膚質資訊 |
| BabyCenter | forum | 父母討論，注重安全性 |

### L1: Topic Grounding（主題定錨）

社群來源使用「主題定錨」取代「商品定錨」：

```markdown
## L1: Topic Grounding

| Field | Value |
|-------|-------|
| **search_query** | {原始搜尋查詢} |
| **normalized_name** | {標準化產品名稱} |
| **brand** | {品牌} |
| **category** | {品類} |
| **matched_asin** | {對應的 Amazon ASIN，若有} |
| **data_source** | {平台名稱} |
| **source_type** | {social/forum/review_site} |
| **posts_analyzed** | {分析的貼文數} |
| **date_range** | {資料日期範圍} |
```

### L2: Claim Extraction（跳過）

社群來源**跳過 L2**，因為沒有官方產品聲明可供驗證。

### L3-L6: 與電商版相同

社群來源的 L3-L6 與電商版相同，但需注意：

| Layer | 社群來源注意事項 |
|-------|-----------------|
| L3 | 貼文內容較長，需 AI 識別相關段落 |
| L4 | 無星級評分，需 AI 推斷情感 |
| L5 | 問題描述更詳細，可提取更多細節 |
| L6 | 需標註「基於社群討論」而非「基於評論」 |

### 社群來源特有標記

| 標記 | 說明 |
|------|------|
| `is_sponsored` | 是否為贊助內容（YouTube） |
| `author_verified` | 作者是否經驗證（Trustpilot） |
| `relevance_score` | AI 判斷的相關性分數 |
| `platform_bias` | 平台偏見標記（ConsumerAffairs 偏負面） |

### 社群來源 JSONL 格式

```json
{
  "scrape_meta": {
    "platform": "reddit",
    "source_type": "social",
    "scraped_at": "2026-02-22T10:00:00Z",
    "search_query": "Mighty Patch",
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
      "content": "...",
      "date": "2026-01-15",
      "url": "https://reddit.com/...",
      "engagement": {"upvotes": 245, "replies": 42},
      "context": {"subreddit": "SkincareAddiction"},
      "language": "en",
      "ai_extracted": {
        "product_mentions": ["Mighty Patch"],
        "aspects_mentioned": ["effectiveness"],
        "sentiment_inference": "positive",
        "relevance_to_query": 0.95
      }
    }
  ],
  "aggregated_stats": {
    "total_posts": 25,
    "positive_posts": 18,
    "negative_posts": 3,
    "neutral_posts": 4
  }
}
```

### 社群來源 .md 輸出模板

```markdown
# {product_name} — 社群評價摘要

## L1: Topic Grounding

| Field | Value |
|-------|-------|
| **search_query** | {query} |
| **data_source** | {platform} |
| **source_type** | social |
| **posts_analyzed** | {count} |
| **date_range** | {range} |
| **matched_asin** | {asin} |

## L3: Aspect Extraction

| Aspect | Category | Mentions | Sentiment |
|--------|----------|----------|-----------|
| {aspect} | {category} | {count} | {sentiment} |

## L4: Aspect Sentiment

| Aspect | Score | Evidence |
|--------|-------|----------|
| {aspect} | {0.0-1.0} | "{quote}" |

## L5: Issue Patterns

| Issue | Frequency | Severity | Sources |
|-------|-----------|----------|---------|
| {issue} | {n}/{total} | {level} | {platforms} |

## L6: Evidence Summary

### Key Insights

1. **{aspect}**: {description}

### Platform Notes

- ⚠️ {platform_specific_notes}

---
*Source: {platform} | Posts: {count} | Date: {date}*
```

### 社群來源 [REVIEW_NEEDED] 觸發條件

1. 相關貼文 < 5 則
2. 平均相關性分數 < 0.7
3. 所有貼文超過 1 年
4. 與電商評論情感差異 > 0.4
5. 平台特定：
   - Reddit: 主要 subreddit 無結果
   - YouTube: 超過 50% 為贊助影片
   - ConsumerAffairs: 正面評價 > 80%（異常）

### 與電商評論整合

社群來源應與電商評論分開呈現，但在 L6 摘要中整合：

```markdown
## L6: Cross-Source Summary

### E-commerce Reviews (Amazon, Best Buy, Walmart)
- Total: {n} reviews
- Avg Rating: {rating}
- Key issues: {issues}

### Social Sources (Reddit, YouTube, Forums)
- Total: {n} posts
- Sentiment: {positive}% positive
- Key insights: {insights}

### Cross-Source Consistency
- Agreement level: {high/medium/low}
- Discrepancies: {list}
