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
- `brand`
- `title`（商品標題）
- `platform`（來源平台）
- `store_id` / `store_name`
- `category`（從品類 enum 中選擇）
- `language`
- `price` / `currency`
- `avg_rating` / `total_count`
- `source_url`
- `fetched_at`
- `reviews_analyzed`（本批次分析的評論數）

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

| Field | Value |
|---|---|
| **product_id** | {ASIN or UPC} |
| **UPC/EAN** | {upc} |
| **ASIN** | {asin} |
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

## L2: Claim Extraction

| # | Claim | Source | Type |
|---|---|---|---|
| 1 | "{claim_text}" | {source_field} | {type} |

## L3: Aspect Extraction

| Aspect | Category | Mentions |
|---|---|---|
| {aspect_key} | {aspect_category} | {count} |

## L4: Aspect Sentiment

| Aspect | Sentiment | Score | Key Evidence |
|---|---|---|---|
| {aspect} | {pos/neg/mixed} | {0.0-1.0} | "{quote}" (x{n}) |

## L5: Issue Patterns

| Issue | Frequency | Severity | Representative Quotes |
|---|---|---|---|
| {issue_key} | {n}/{total} ({pct}%) | {low/med/high} | "{quote}" |

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

- [ ] product_id 正確提取（ASIN 或 UPC/EAN）
- [ ] category 使用 enum 定義值
- [ ] aspect 名稱使用英文
- [ ] score 在 0.0-1.0 範圍內
- [ ] frequency 分母為本批次評論總數
- [ ] severity 判定符合定義
- [ ] 引述保留原文語言
- [ ] 未自行擴大 REVIEW_NEEDED 判定範圍
- [ ] 未產生無來源的聲明
- [ ] batch_index > 1 時未執行 L1-L2
