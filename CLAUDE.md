# 電商商品評論智慧分析系統 — 系統執行指令

本系統透過 Claude CLI 編排多角色協作，完成電商商品評論的擷取、萃取與報告生成。

| 角色 | 職責 | 定義位置 |
|------|------|----------|
| **Architect** | 系統巡檢、指揮協調 | Claude CLI 頂層直接扮演 |
| **Extractor** | 資料擷取 + L1-L6 萃取 | `core/Extractor/CLAUDE.md` |
| **Narrator** | 跨來源綜合分析、報告產出 | `core/Narrator/CLAUDE.md` |
| **Reviewer** | 自我審核 Checklist | 內嵌於各 Layer/Mode 的 CLAUDE.md |

> 系統維護（新增/修改/刪除 Layer、Mode、資料源）請參照 `core/CLAUDE.md`。

---

## 執行流程

使用者說「執行完整流程」時，依序執行以下 8 個步驟。

```
使用者輸入「執行完整流程」
        ↓
    檢查 execution_state.json 是否存在
        ├── 不存在 → 從 Step 1 開始
        └── 存在 → 讀取狀態，判斷執行模式
        ↓
    判斷執行模式（每日自動判斷）
        ├── 今日首次執行 → 完整流程（Step 1-8）
        ├── 今日已執行過 → 增量更新模式
        └── 中斷恢復 → 從中斷點繼續
        ↓
Step 1: 監控清單追蹤（平行執行）
        ├── 讀取 docs/Extractor/watchlist.json
        ├── 對監控產品重新抓取評論
        ├── 比對前次分析結果，偵測變化
        └── 若有重大變化 → 觸發 Step 7-8 重新分析
        ↓
Step 2: 研究缺口補齊（平行執行）
        ├── 掃描所有 [REVIEW_NEEDED] 報告
        ├── 識別缺口類型（研究不足/競品不足/評論不足）
        ├── 自動執行補充研究（Step 5）或補充抓取（Step 6）
        └── 補齊後重新執行 Step 7-8
        ↓
Step 3: 抓取排行榜（增量模式：僅抓取新產品）
        ├── Amazon Discovery: bestsellers（各品類前 100）
        ├── Amazon Discovery: movers（快速上升）
        └── 去重後得到熱門產品清單
        ↓
Step 4: 產品分組（按具體問題）
        ├── Claude 分析每個產品「解決什麼具體問題」
        ├── 按問題類別分組（例：痘痘治療、尿布疹護理）
        ├── ⚠️ 禁止族群導向分組（如 baby-care、children-entertainment）
        └── 輸出：docs/Extractor/problem_groups.md
        ↓
Step 5: 問題研究 + 競品發現
        ├── 對每個問題類別執行深度研究
        ├── 12 組關鍵字面向 × 20+ 次 WebSearch = 200+ 搜尋結果
        ├── 從不重複內容中做 100+ 次 WebFetch
        ├── 從評測文章萃取競品名稱
        └── 輸出：
            ├── docs/Extractor/research/{問題}--{date}.md
            └── docs/Extractor/competitors/{問題}--{date}.md
        ↓
Step 6: 抓取評論 + 萃取
        ├── 抓取範圍：原產品 + 競品（有 Amazon ASIN）
        ├── fetch.sh 抓取評論（輸出 JSONL）
        ├── L1-L6 萃取（JSONL → .md）
        └── 輸出：docs/Extractor/{layer}/{category}/{product}.md
        ↓
Step 7: 比較分析（多來源）
        ├── 輸入：
        │   ├── Step 6 萃取結果（Amazon 產品 + 有 ASIN 競品）
        │   └── Step 5 評測資料（無 Amazon 競品）
        ├── 負評三分類：
        │   ├── ❌ 無法解決問題（功能失效）
        │   ├── ⚠️ 產生新問題（副作用）
        │   └── 📦 與產品無關（物流）
        └── 判斷：這產品相比「所有競品」，是否真的能解決問題？
        ↓
Step 8: 條件性產出報告
        ├── ✅ 能解決問題，且比競品好 → 推薦報告
        │   └── docs/Narrator/recommendations/{問題}--{date}.md
        ├── ⚖️ 能解決問題，但有更好選擇 → 比較報告
        │   └── docs/Narrator/comparisons/{問題}--{date}.md
        ├── ❌ 無法解決問題 → 警告報告
        │   └── docs/Narrator/warnings/{產品}--{date}.md
        └── 💢 全部產品都有嚴重問題 → 痛點報告
            └── docs/Narrator/pain_points/{問題}--{date}.md
```

### Step 1: 監控清單追蹤

對 `docs/Extractor/watchlist.json` 中的產品執行追蹤更新。

#### 監控清單格式

```json
{
  "last_updated": "2026-02-06T12:00:00Z",
  "products": [
    {
      "asin": "B092J8LPWR",
      "name": "HANYCONY 8 Outlets Power Strip",
      "category": "power-strip",
      "watch_reason": "fire_hazard",
      "severity": "critical",
      "added_date": "2026-02-06",
      "last_checked": "2026-02-06",
      "check_interval_days": 7,
      "alerts": [
        {
          "type": "recall_check",
          "description": "監控是否有召回行動"
        }
      ],
      "baseline": {
        "fire_rate": "4%",
        "avg_rating": 4.2,
        "review_count": 1500
        }
    }
  ],
  "categories": [
    {
      "name": "squishy-toy",
      "watch_reason": "research_gap",
      "added_date": "2026-02-06",
      "action": "supplement_research"
    }
  ]
}
```

#### 監控原因類型

| watch_reason | 說明 | 追蹤動作 |
|--------------|------|---------|
| `fire_hazard` | 火災/安全風險 | 每週檢查新評論、搜尋召回新聞 |
| `quality_crisis` | 品質控制危機 | 每週檢查批次問題是否改善 |
| `design_flaw` | 設計缺陷 | 每月檢查是否有新版本 |
| `product_integrity` | 產品完整性問題 | 每週檢查重新密封/缺少內容物率 |
| `review_anomaly` | 評論異常 | 每週檢查驗證購買率變化 |
| `counterfeit_risk` | 假貨風險 | 每週監控賣家變更、官方聲明、評論模式 |
| `research_gap` | 研究資料不足 | 立即執行補充研究 |

#### 追蹤執行邏輯

```
讀取 watchlist.json
        ↓
計算距離上次執行的天數
        ↓
過濾需要檢查的項目（依補檢查規則）
        ↓
    平行執行追蹤任務：
    ├── 重新抓取評論（最新 50 則）
    ├── WebSearch 搜尋產品名 + "recall" / "warning" / "fire"
    ├── 比對 baseline 數據
    └── 偵測重大變化
        ↓
    變化判定：
    ├── 負評率變化 > 10% → 觸發重新分析
    ├── 發現召回新聞 → 更新警告報告
    ├── 問題改善（負評率下降 > 20%）→ 考慮移除監控
    └── 無重大變化 → 更新 last_checked
```

#### 補檢查規則（距離上次執行 > 1 天時）

| 嚴重度 | 補檢查範圍 |
|--------|-----------|
| `critical` | 補檢查所有過期項目 |
| `high` | 補檢查所有過期項目 |
| `medium` | 僅檢查最近 7 天內到期的項目 |

> 若距離上次執行超過 14 天，視為「冷啟動」，所有監控項目都要檢查。

#### 自動加入監控的觸發條件

Step 8 產出警告報告時，自動將產品加入監控清單：

| 警告類型 | 嚴重度 | 監控間隔 |
|---------|--------|---------|
| 火災/安全風險 | `critical` | 7 天 |
| 品質控制問題（>20% 負評） | `high` | 7 天 |
| 設計缺陷 | `medium` | 14 天 |
| 評論異常（疑似刷評） | `medium` | 7 天 |

### Step 2: 研究缺口補齊

自動識別並補齊資料不足的類別。

#### 缺口識別規則

掃描所有報告，識別 `[REVIEW_NEEDED]` 標記的原因：

| 缺口類型 | 識別方式 | 補齊動作 |
|---------|---------|---------|
| 研究不足 | WebSearch < 20 或 WebFetch < 100 | 重新執行 Step 5 |
| 競品不足 | competitors.md 中有 ASIN 的競品 < 3 | 擴大 WebSearch 範圍 |
| 評論不足 | 分析評論 < 50 則 | 重新抓取更多評論 |
| 競品無萃取 | 競品有 ASIN 但無萃取結果 | 執行 Step 6 抓取 |

#### 補齊執行邏輯

```
掃描 docs/Narrator/*/*.md
        ↓
提取 [REVIEW_NEEDED] 報告清單
        ↓
分析各報告的缺口類型
        ↓
    平行執行補齊任務：
    ├── 研究不足 → Task(Step 5 研究, sonnet)
    ├── 競品不足 → Task(擴大競品搜尋, sonnet)
    ├── 評論不足 → Task(重新抓取, Bash)
    └── 競品無萃取 → Task(Step 6 萃取, sonnet)
        ↓
補齊完成後，重新執行 Step 7-8（僅該類別）
```

#### 補齊優先級

| 優先級 | 條件 | 說明 |
|--------|------|------|
| 🔴 高 | 警告報告資料不足 | 安全相關必須優先補齊 |
| 🟠 中 | 痛點報告資料不足 | 影響市場洞察 |
| 🟢 低 | 比較報告資料不足 | 不影響核心結論 |

#### 補齊失敗處理（暫緩機制）

當類別連續 3 次補齊失敗時，自動暫緩：

```
補齊嘗試 1 → 失敗
        ↓
補齊嘗試 2 → 失敗
        ↓
補齊嘗試 3 → 失敗
        ↓
標記為「暫緩發佈」，加入 deferred_categories
        ↓
報告移至 docs/Narrator/deferred/{類別}--{date}.md
        ↓
每週一自動重試暫緩類別
```

**暫緩狀態記錄**（在 watchlist.json）：

```json
{
  "deferred_categories": [
    {
      "name": "squishy-toy",
      "deferred_date": "2026-02-06",
      "retry_count": 3,
      "next_interval_days": 5,
      "reason": "WebSearch 無法找到足夠的紓壓玩具評測文章",
      "next_retry": "2026-02-11",
      "manual_action_needed": "需人工提供關鍵字或評測網站"
    }
  ]
}
```

**暫緩類別重試策略**（Fibonacci 間隔）：

| 重試次數 | 間隔天數 | 累計天數 |
|---------|---------|---------|
| 第 1 次 | 1 天 | 1 天 |
| 第 2 次 | 2 天 | 3 天 |
| 第 3 次 | 3 天 | 6 天 |
| 第 4 次 | 5 天 | 11 天 |
| 第 5 次 | 8 天 | 19 天 |
| 第 6 次 | 13 天 | 32 天 |
| 第 7 次 | 21 天 | 53 天 |
| 第 8 次+ | 34 天 | 維持 34 天 |

| 條件 | 重試時機 |
|------|---------|
| 人工介入後 | 立即重試（下次執行時），重置間隔 |

**暫緩不代表放棄**：
- 自動依 Fibonacci 間隔重試
- 可手動執行「強制補齊 {類別}」重新嘗試
- 人工介入後標記為「已處理」，下次執行立即重試，間隔重置為 1 天

### Step 3: 抓取排行榜

掃描 `core/Extractor/Layers/*/`，排除含有 `.disabled` 檔案的目錄。
執行各 Layer 的 discovery 機制（如 Amazon bestsellers）取得熱門產品清單。

#### 增量模式（每日執行）

若今日已執行過 Step 3，則採用增量模式：

```
讀取今日排行榜快取（docs/Extractor/discovery_cache/{date}.json）
        ↓
比對昨日排行榜
        ↓
    識別變化：
    ├── 新進榜產品 → 加入待分析清單
    ├── 排名大幅變動（±20 名）→ 標記需關注
    ├── 退榜產品 → 記錄但不處理
    └── 無變化 → 跳過
        ↓
僅對新產品執行 Step 4-8
```

### Step 4: 產品分組

Claude 分析每個產品「解決什麼問題」，按 **具體問題** 分組。

#### 每日增量行為

| 情況 | 處理 |
|------|------|
| 新產品 → 已有類別 | 加入該類別，跳過 Step 5（使用既有研究，除非已過期） |
| 新產品 → 新類別 | 建立新類別，執行完整 Step 5-8 |
| 無新產品 | 跳過 Step 4-8（僅執行 Step 1-2） |

> 「已有類別」指 `problem_groups.md` 中已存在且研究報告未過期（≤30 天）的類別。

#### 分組原則（強制）

1. **按具體問題分組，非使用者族群**
   - ❌ `baby-care`（嬰兒用品）→ 族群導向，內含不可比較的產品
   - ✅ `diaper-rash`（尿布疹護理）→ 問題導向，產品可直接比較

2. **同類別產品必須可直接比較**
   - 問自己：「這兩個產品是在解決同一個問題嗎？」
   - 如果答案是「不是」，它們不應該在同一類別

3. **拆分規則**
   | 錯誤分組 | 正確拆分 |
   |---------|---------|
   | `baby-care` | `diaper-rash`, `cradle-cap`, `bath-toys`, `baby-car-monitor` |
   | `children-entertainment` | `building-blocks`, `board-games`, `art-supplies`, `trading-cards` |
   | `party-supplies` | `birthday-decoration`, `valentine-cards`, `costume` |
   | `household-cleaning` | `floor-mopping`, `laundry-stain`, `dish-sponge`, `trash-bags` |

**分析內容**：
- **這產品解決什麼具體問題？**（例：Mighty Patch → 痘痘治療，非「美容」）
- **問題發生的原因？**（例：皮脂分泌、毛孔堵塞、細菌）
- **有哪些解決方法？**（例：水膠體貼片、藥膏、水楊酸）

**輸出**：`docs/Extractor/problem_groups.md`

```markdown
# 產品問題分組

生成日期：{date}
產品總數：{N}
問題類別數：{M}

## 分組總覽

| 問題類別 | 問題描述 | 產品數 | 研究狀態 |
|---------|---------|-------|---------|
| acne-treatment | 痘痘治療 | 5 | ⏳ 待研究 |
| diaper-rash | 尿布疹護理 | 3 | ⏳ 待研究 |

## 詳細分組

### acne-treatment

**問題描述**：如何有效治療/預防痘痘

**問題成因**：皮脂分泌過多、毛孔堵塞、細菌感染

**常見解決方法**：
- 水膠體貼片
- 水楊酸產品
- 過氧化苯甲醯

**包含產品**：
| product_id | 商品名稱 | 採用的解決方法 |
|-----------|---------|---------------|
| B07XXX | Mighty Patch Original | 水膠體貼片 |

**研究文件**：`research/acne-treatment--{date}.md`
**競品文件**：`competitors/acne-treatment--{date}.md`
```

**狀態標記**：
| 狀態 | 意義 |
|------|------|
| ⏳ 待研究 | Step 4 分組完成，尚未執行 Step 5 |
| 🔄 研究中 | Step 5 WebSearch/WebFetch 進行中 |
| ✅ 已完成 | Step 5 研究完成，可進行後續步驟 |

### Step 5: 問題研究 + 競品發現

對每個問題類別執行深度研究，**同時建立競品清單**。

#### 雙重目標

| 目標 | 輸出 | 用途 |
|------|------|------|
| 問題研究 | `research/{問題}--{date}.md` | 理解問題背景 |
| **競品發現** | `competitors/{問題}--{date}.md` | Step 5 比較對象 |

#### WebSearch/WebFetch 規則

| 項目 | 規則 |
|------|------|
| 關鍵字面向 | 12 組（見下方列表） |
| WebSearch | 20+ 次，產出 200+ 條搜尋結果標題/摘要 |
| WebFetch | 100+ 次，從不重複內容中閱讀完整網頁 |
| ⚠️ **URL 來源** | **WebFetch 的 URL 必須來自 WebSearch 結果，禁止猜測 URL** |
| 不足處理 | 若 20 次 WebSearch 後 WebFetch 不足 100，重新定義關鍵字繼續 |
| 提前結束 | 某次 WebSearch 清單看完就滿足 100 次 WebFetch，才可結束 |
| 必要記錄 | 搜尋關鍵字 + 資料來源清單 |
| **競品萃取** | 從評測文章中提取推薦的產品名稱 |

**WebFetch 執行流程（強制）**：
```
1. 執行 WebSearch 取得搜尋結果
2. 從搜尋結果的 Links 陣列中選擇 URL
3. 使用這些 URL 執行 WebFetch
4. ❌ 禁止：直接輸入猜測的 URL（如 www.example.com/article）
5. ❌ 禁止：使用過去記憶中的 URL（可能已失效）
```

**WebSearch/WebFetch 退避策略**：

當遇到 rate limit 或錯誤時，採用指數退避：

| 重試次數 | 等待時間 | 說明 |
|---------|---------|------|
| 第 1 次 | 5 秒 | 快速重試 |
| 第 2 次 | 15 秒 | 短暫等待 |
| 第 3 次 | 45 秒 | 較長等待 |
| 第 4 次 | 2 分鐘 | 降低頻率 |
| 第 5 次+ | 5 分鐘 | 最大間隔 |

**自動降速機制**：

```
連續 3 次失敗（同一 Step）
        ↓
降低該 Step 的平行數為原來的 50%
        ↓
連續 5 次成功
        ↓
逐步恢復平行數
```

**全域 Rate Limit 處理**：

當偵測到全域 rate limit（連續 5 分鐘所有請求失敗）：
1. 暫停所有 WebSearch/WebFetch 任務
2. 等待 10 分鐘
3. 以最低平行數（1）重新開始
4. 記錄到 error_log.json
5. 在每日摘要中標記

**12 組關鍵字面向**：
1. 問題成因
2. 解決方法比較
3. **產品評測**（重點萃取競品）
4. 成分/技術原理
5. 使用者經驗
6. 品牌知名度
7. 代言人
8. 副作用/風險
9. 價格比較
10. 專家意見
11. 科學研究
12. 市場趨勢

#### 競品發現規則

在閱讀評測文章時，萃取以下資訊：

```
WebFetch 評測文章 → 萃取：
├── 推薦產品名稱
├── 推薦理由
├── 是否有 Amazon 連結
└── 文章評分/排名（如有）
```

**競品篩選標準**：
1. 必須解決 **相同問題**（如都是痘痘貼片，非洗面乳）
2. 至少在 **2 篇以上** 評測文章中被推薦
3. 優先納入有 Amazon 連結的（可在 Step 6 抓取評論）

**競品清單增量更新策略**：

當類別已有 competitors.md 時，不重新產出而是增量更新：

| 情況 | 處理 |
|------|------|
| 現有競品仍被推薦 | 更新推薦次數和來源 |
| 發現新競品 | 新增到清單末尾 |
| 現有競品不再被推薦 | 保留但標記 `[STALE]` |
| 競品下架 | 標記 `[DELISTED]` |

**增量更新格式**（competitors.md 標頭）：

```markdown
# {問題類別} 競品清單

初次生成：2026-02-01
最後更新：2026-02-06
更新類型：增量更新（+2 新競品，1 標記過時）

## 變更記錄
| 日期 | 變更 |
|------|------|
| 2026-02-06 | +2 新競品（Product X, Product Y），Product Z 標記 [STALE] |
| 2026-02-01 | 初次生成，5 個競品 |
```

**完整重新研究觸發條件**：
- 研究報告過期（> 30 天）
- 超過 50% 競品標記 `[STALE]` 或 `[DELISTED]`
- 使用者手動指令「重新研究 {類別}」

**輸出 1**：`docs/Extractor/research/{問題類別}--{date}.md`

```markdown
# {問題類別} 深度研究

生成日期：{date}
問題類別：{problem_category}
相關產品數：{N}

## 搜尋關鍵字

| # | 面向 | 關鍵字 | WebSearch 次數 | 有效結果數 |
|---|------|--------|---------------|-----------|
| 1 | 問題成因 | "acne causes 2026" | 2 | 15 |
| 2 | 解決方法比較 | "hydrocolloid vs salicylic acid" | 2 | 12 |

**WebSearch 總次數**：{N}
**WebFetch 總次數**：{N}

## 研究摘要

### 問題成因
{摘要內容，引用資料來源}

### 解決方法比較
{摘要內容}

### 主要品牌與代言人
{摘要內容}

### 副作用與風險
{摘要內容}

### 專家意見與科學研究
{摘要內容}

## 資料來源

| # | 標題 | URL | 面向 |
|---|------|-----|------|
| 1 | "Best Pimple Patches 2026" | https://... | 產品評測 |
| 2 | "How Hydrocolloid Works" | https://... | 成分原理 |

---
*Generated: {date} | WebSearch: {N} | WebFetch: {N}*
```

**輸出 2**：`docs/Extractor/competitors/{問題類別}--{date}.md`

```markdown
# {問題類別} 競品清單

生成日期：{date}
問題類別：{problem_category}
發現競品數：{N}

## 競品總覽

| # | 產品名稱 | 品牌 | 推薦次數 | Amazon 連結 | 來源 |
|---|---------|------|---------|-------------|------|
| 1 | Mighty Patch Original | Hero Cosmetics | 8 | B074PVTPBW | [1][3][5] |
| 2 | COSRX Acne Pimple Master Patch | COSRX | 6 | B00PBX3TN6 | [2][4][6] |
| 3 | ZitSticka Killa Kit | ZitSticka | 4 | B07YBKNMYQ | [1][7] |
| 4 | Starface Hydro-Stars | Starface | 3 | ❌ 無 | [2][8] |

## 詳細資訊

### 1. Mighty Patch Original
- **品牌**: Hero Cosmetics
- **Amazon ASIN**: B074PVTPBW
- **推薦來源**:
  - [1] Allure: "Best Pimple Patch for Deep Acne"
  - [3] Byrdie: "Editor's Choice"
  - [5] Wirecutter: "Best Overall"
- **推薦理由**: 吸收力強、適合深層痘痘、夜間使用效果佳

### 2. COSRX Acne Pimple Master Patch
- **品牌**: COSRX
- **Amazon ASIN**: B00PBX3TN6
- **推薦來源**:
  - [2] Healthline: "Best Budget Option"
  - [4] Good Housekeeping: "Best Value"
- **推薦理由**: 性價比高、韓國品牌、薄透自然

### 4. Starface Hydro-Stars
- **品牌**: Starface
- **Amazon ASIN**: ❌ 無（官網直售）
- **評測來源數據**:
  - [2] Teen Vogue: 4.5/5 星
  - [8] Cosmopolitan: "Best for Teens"
- **推薦理由**: 星星造型可愛、適合青少年、社群熱門

## 資料來源

| # | 標題 | URL | 發現競品數 |
|---|------|-----|-----------|
| [1] | "10 Best Pimple Patches 2026" | https://allure.com/... | 5 |
| [2] | "Dermatologist-Approved Acne Patches" | https://healthline.com/... | 4 |

---
*Generated: {date} | 發現競品: {N} | 有 Amazon: {M}*
```

### Step 6: 抓取評論 + 萃取

對 **原產品 + 競品（有 Amazon ASIN）** 執行：

#### 抓取範圍

```
Step 3 產品（Amazon 排行榜）
        +
Step 5 競品（有 Amazon ASIN）
        ↓
    合併為抓取清單
```

**競品處理**：
1. 讀取 `competitors/{問題}--{date}.md`
2. 提取有 Amazon ASIN 的競品
3. 將 ASIN 加入該類別的抓取清單
4. 執行 fetch + 萃取

#### 執行流程

1. **fetch** — 執行 `core/Extractor/Layers/{layer}/fetch.sh`，輸出到 `docs/Extractor/{layer}/raw/*.jsonl`
2. **定位 JSONL** — `ls docs/Extractor/{layer}/raw/*.jsonl` 取得所有 JSONL 檔案路徑
3. **萃取** — 對每個 JSONL 逐行處理（見下方 JSONL 處理規範）
4. **合併**（若 `batch_total > 1`）— 讀取所有 batch .md，合併為最終 `{product_id}--{store_id}--{date}.md`
5. **update** — 將**最終版 .md** 路徑傳入 `update.sh`

#### JSONL 處理規範

> **⛔ 禁止用 Read 工具直接讀取 `.jsonl` 檔案。** JSONL 可能數百 KB，會超出 token 上限。

| 操作 | 方法 |
|------|------|
| 取得行數 | `wc -l < {file}` |
| 逐行讀取 | `sed -n '{N}p' {file}` |
| 分派萃取 | 每行交由一個 Task 子代理處理 |
| 寫出 .md | 子代理透過 Write tool（不用 Bash heredoc） |

每個萃取 Task 接收：
- 單一 JSON 字串（sed 取出的該行）
- Layer CLAUDE.md 的萃取邏輯 + `core/Extractor/CLAUDE.md` 的 L1-L6 協議
- batch_index 資訊（決定是否執行 L1-L2）

#### 萃取前去重

以**檔名**比對去重（檔名格式：`{product_id}--{store_id}--{date}.md`）：

```bash
# 檢查該商品今日是否已有最終版萃取結果
ls docs/Extractor/{layer}/*/{product_id}--{store_id}--$(date +%Y-%m-%d).md 2>/dev/null
```

- 檔案已存在 → **跳過**（同日不重複萃取）
- 檔案不存在 → 正常萃取

#### 批次合併

爬蟲自動分批輸出，每行最多 50 則評論：

| 批次 | 執行內容 | 輸出 |
|------|----------|------|
| batch_index = 1 | L1-L6 完整流程 | `{product_id}--{store_id}--batch-1.md` |
| batch_index = 2..N | 僅 L3-L5 | `{product_id}--{store_id}--batch-N.md` |
| 合併步驟 | 讀取所有 batch .md，合併數據 | `{product_id}--{store_id}--{date}.md` |

合併規則：
- **L1、L2**：取 batch-1 結果
- **L3**：合併所有批次 aspect，加總 mentions
- **L4**：重新計算加權平均 score，合併 evidence quotes
- **L5**：重新計算 frequency（分母為全部評論數）
- **L6**：基於合併後 L1-L5 重新生成

### Step 7: 比較分析

對每個 **問題類別** 內的所有產品進行比較分析。

#### 比較來源（多來源）

| 來源 | 資料類型 | 取得方式 |
|------|---------|---------|
| Amazon 產品 | L1-L6 萃取結果 | Step 6 |
| 競品（有 Amazon） | L1-L6 萃取結果 | Step 6（新增抓取） |
| **競品（無 Amazon）** | **評測文章摘要** | Step 5 WebFetch |

#### 無 Amazon 競品的處理

對於在 `competitors/{問題}.md` 中標記為「❌ 無 Amazon」的產品：

```
競品（無 Amazon）→ 使用 Step 5 評測資料：
├── 評測文章的評分/排名
├── 評測文章的優缺點摘要
├── 評測文章的使用者評價引述
└── 標記為「基於評測文章，非用戶評論」
```

**報告中標示方式**：
```markdown
### Starface Hydro-Stars
⚠️ **資料來源：評測文章**（非 Amazon 用戶評論）

**評測摘要**：
- Teen Vogue: 4.5/5 星 - "Best for Teens"
- Cosmopolitan: "星星造型可愛，適合青少年"

**優點**（基於評測）：
- 造型可愛，增加使用意願
- 透明度高，日間可使用

**缺點**（基於評測）：
- 價格較高
- 吸收力略遜於 Mighty Patch
```

#### 負評三分類

對每個產品的負評進行三分類：

| 類型 | 說明 | 符號 |
|------|------|------|
| 無法解決問題 | 核心功能失效 | ❌ |
| 產生新問題 | 副作用、延伸問題 | ⚠️ |
| 與產品無關 | 物流、賣家問題 | 📦 |

#### 比較維度

| 維度 | Amazon 產品 | 評測文章產品 |
|------|------------|-------------|
| 功能有效性 | L4 sentiment score | 評測評分 |
| 安全性 | L5 issue frequency | 評測提及的風險 |
| 性價比 | L1 價格 + L4 價值評分 | 評測價格比較 |
| 使用體驗 | L3 aspects | 評測優缺點 |

**判斷**：這產品相比競品，是否真的能解決問題？

### Step 8: 條件性產出報告

| 分析結果 | 產出 | 輸出路徑 |
|---------|------|----------|
| 能解決問題，且比競品好 | 推薦報告 | `docs/Narrator/recommendations/` |
| 能解決問題，但競品更好 | 比較報告 | `docs/Narrator/comparisons/` |
| 無法解決問題 | 警告報告 | `docs/Narrator/warnings/` |
| 全部產品都有嚴重問題 | 痛點報告 | `docs/Narrator/pain_points/` |

報告框架見 `core/Narrator/Modes/problem_solver/CLAUDE.md`。

#### `[REVIEW_NEEDED]` 非阻塞式決策機制

當報告未通過審核時，**不阻塞其他任務**，而是加入待決策佇列：

```
Step 8 類別 A 產出報告
    ├── 通過審核 → 正常輸出
    └── [REVIEW_NEEDED] → 加入「待決策佇列」，繼續執行其他類別

Step 8 類別 B、C、D... 繼續平行執行（不受影響）
        ↓
所有 Step 8 任務完成
        ↓
顯示「待決策佇列」，詢問使用者決定
        ↓
記錄使用者決策至 decision_log.json
```

**待決策佇列**（`docs/Extractor/pending_decisions.json`）：

```json
{
  "pending_decisions": [
    {
      "category": "squishy-toy",
      "report_type": "comparison",
      "reason": "研究資料不足（WebFetch 僅 45 次）",
      "options": ["立即補齊", "等明天", "跳過此類別", "直接發佈"],
      "created_at": "2026-02-06T15:30:00Z"
    }
  ]
}
```

**決策記錄**（`docs/Extractor/decision_log.json`）：

```json
{
  "decisions": [
    {
      "category": "squishy-toy",
      "reason": "研究資料不足",
      "user_decision": "等明天",
      "decided_at": "2026-02-06T15:35:00Z",
      "context": "首次遇到此類別"
    }
  ]
}
```

**漸進式自動化**：

累積足夠決策後，系統可識別使用者偏好模式：
- 當「原因 = 研究資料不足」且過去 5 次都選「等明天」→ 自動選擇「等明天」
- 當「原因 = 競品不足」且過去 5 次都選「立即補齊」→ 自動選擇「立即補齊」

自動化觸發條件：
- 同一原因類型累積 **≥5 次**相同決策
- 自動化決策會在摘要中標註 `[AUTO]`
- 使用者可隨時覆寫自動化決策

**Qdrant 資料查詢**：
```bash
qdrant_scroll "$QDRANT_COLLECTION" \
  '{"must":[{"key":"product_id","match":{"value":"'"$pid"'"}}]}' 100
```

**Qdrant 不可用時的退化方案**：
```bash
find docs/Extractor -name "${product_id}--*.md" -not -name "*batch*" -type f
```

---

## 模型與子代理指派規則

| Step | 任務 | 模型 | 子代理類型 | 原因 |
|------|------|------|------------|------|
| 1 | 監控清單追蹤 | `sonnet` | `general-purpose` | 需讀取 + 分析 |
| 2 | 研究缺口補齊 | `sonnet` | `general-purpose` | 需 WebSearch + Write |
| 3 | 抓取排行榜 | `sonnet` | `Bash` | 純腳本執行 |
| 4 | 產品分組（按具體問題） | `sonnet` | `general-purpose` | 分析任務 |
| 5 | 問題研究（WebSearch/WebFetch） | `sonnet` | `general-purpose` | 需 WebSearch + WebFetch |
| 5 | 競品發現（萃取競品名稱） | `sonnet` | `general-purpose` | 需 Write tool |
| 6 | fetch.sh 執行（含競品） | `sonnet` | `Bash` | 純腳本執行 |
| 6 | L1-L6 萃取（JSONL → .md） | `sonnet` | `general-purpose` | 需 Write tool |
| 6 | 批次合併 | `sonnet` | `general-purpose` | 需讀取 + 寫入 |
| 6 | update.sh 執行 | `sonnet` | `Bash` | 純腳本執行 |
| 7 | 比較分析（多來源） | `sonnet` | `general-purpose` | 分析任務 |
| 8 | 報告產出 | `opus` | `general-purpose` | 跨來源綜合分析 |

**強制規則**：
- **只有 Step 8**（報告產出）使用 `opus`，其餘一律 `sonnet`
- 需寫入檔案的 Task → `general-purpose`（透過 Write tool）
- 純腳本執行 → `Bash`

### 平行分派策略（強制）

執行時**必須**盡可能平行分派，以提升效率。

#### 批次大小建議

| Step | 任務類型 | 最大平行數 | 原因 |
|------|---------|-----------|------|
| 1 | 監控追蹤 | 10 | 避免觸發 rate limit |
| 2 | 研究補齊 | 5 | WebSearch 有頻率限制 |
| 3 | 排行榜抓取 | 3 | 每個 Layer 一個 |
| 5 | 問題研究 | **1** | **序列執行**（WebFetch 權限限制） |
| 6 | 評論抓取 | 5 | 避免 Amazon 封鎖 |
| 6 | JSONL 萃取 | 15 | CPU 密集，可大量平行 |
| 7 | 比較分析 | 15 | 分析任務，可大量平行 |
| 8 | 報告產出 | 10 | opus 模型，適度平行 |

> **Step 5 序列執行說明**（2026-02-08 決策）：
> WebFetch 在 Task 子代理中需要互動式權限確認。當多個代理平行執行時，權限提示無法處理導致 WebFetch 失敗。
> 因此 Step 5 改為序列執行：一個類別的研究完成後，再開始下一個類別。
> 單一代理內的多次 WebFetch 仍可正常運作。

#### 平行執行矩陣

| 場景 | 平行方式 | 批次大小 |
|------|---------|---------|
| Step 1 監控追蹤 | 多個產品同時檢查 | 10 |
| Step 2 研究補齊 | 多個類別同時補齊 | 5 |
| **Step 5 問題研究** | **序列執行（一次一個類別）** | **1** |
| Step 5 WebFetch | 同一類別內由單一代理執行 | N/A |
| Step 6 評論抓取 | 多個 ASIN 同時抓取 | 5 |
| Step 6 JSONL 萃取 | 多個 JSONL 同時萃取 | 15 |
| Step 6 批次處理 | 同一商品多 batch 同時萃取 | 全部 |
| Step 7 比較分析 | 多個問題類別同時分析 | 15 |
| Step 8 報告產出 | 多個問題類別同時產出 | 10 |

#### 流水線執行（Pipeline）

不需要等待前一 Step 完全結束才開始下一 Step：

```
Step 5 類別 A 完成 → 立即開始 Step 6 類別 A（同時 Step 5 類別 B 繼續）
Step 6 類別 A 完成 → 立即開始 Step 7 類別 A（同時 Step 6 類別 B 繼續）
Step 7 類別 A 完成 → 立即開始 Step 8 類別 A（同時 Step 7 類別 B 繼續）
```

#### 平行執行範例

```
單一訊息中同時發送：
├── Task(Step 7 類別 1, sonnet)
├── Task(Step 7 類別 2, sonnet)
├── Task(Step 7 類別 3, sonnet)
├── Task(Step 7 類別 4, sonnet)
├── Task(Step 7 類別 5, sonnet)
└── Task(Step 7 類別 6, sonnet)
        ↓
等待全部完成
        ↓
單一訊息中同時發送：
├── Task(Step 8 類別 1, opus)
├── Task(Step 8 類別 2, opus)
...
```

**禁止序列執行**（Step 5 除外）：
- ❌ 一個 JSONL 萃取完才開始下一個
- ❌ 等待整個 Step 完成才開始下一個 Step（Step 5 除外）

**Step 5 例外**：
- ✅ Step 5 問題研究**必須序列執行**（一個類別完成後再開始下一個）
- 原因：WebFetch 權限限制，平行執行會導致失敗

**正確做法**：
- ✅ Step 5：序列執行，每次只啟動一個研究 Task
- ✅ 其他 Step：單一訊息中發送多個 Task tool calls（最多依批次大小）
- ✅ 使用 `run_in_background: true` 處理長時間任務
- ✅ 流水線執行：某類別完成即可進入下一 Step
- ✅ 合併步驟等待所有平行任務完成後再執行

#### 並行任務失敗處理

| 失敗比例 | 處理策略 |
|---------|---------|
| <20% | 僅重試失敗的任務，其餘繼續下一 Step |
| 20-50% | 暫停，詢問使用者是否繼續 |
| >50% | 中止該 Step，記錄錯誤至 error_log.json |

**重試規則**：
- 每個任務最多重試 2 次
- 重試間隔：30 秒
- 重試後仍失敗 → 標記為 `[TASK_FAILED]`，在每日摘要中列出

---

## 每日執行模式

當使用者每日執行「執行完整流程」時，系統採用增量更新模式以提升效率。

### 每日執行流程

```
「執行完整流程」
        ↓
讀取 execution_state.json
        ↓
判斷執行模式
    ├── last_completed_date = 今日 → 增量模式
    ├── last_completed_date = 昨日 → 標準每日更新
    └── last_completed_date > 1 天前 → 完整重跑
        ↓
增量模式執行順序：
    1. Step 1 監控清單追蹤（平行）
    2. Step 2 研究缺口補齊（平行）
    3. Step 3 增量排行榜（僅新產品）
    4. Step 4-8 僅處理新產品/變動產品
        ↓
完成後更新 execution_state.json
```

### 跨日執行處理

當執行時間跨越午夜（00:00）時，需要特殊處理以確保資料一致性。

#### 執行日期判定

| 時間點 | 判定規則 |
|--------|---------|
| 執行開始時間 | 作為「執行日期」的基準 |
| 跨日後完成 | 使用開始日期，不改變 |
| 報告/萃取檔案日期 | 使用執行開始日期 |
| daily_summary 日期 | 使用執行開始日期 |

#### 跨日場景處理

```
執行開始：2026-02-06 23:30
執行結束：2026-02-07 01:15
        ↓
所有輸出檔案使用 2026-02-06：
├── docs/Extractor/research/acne-treatment--2026-02-06.md
├── docs/Narrator/recommendations/acne-treatment--2026-02-06.md
├── docs/daily_summary/2026-02-06.md
└── execution_state.json: last_completed_date = "2026-02-06"
        ↓
2026-02-07 再次執行：
└── 視為「標準每日更新」（last_completed_date = 昨日）
```

#### execution_state.json 跨日記錄

```json
{
  "last_updated": "2026-02-07T01:15:00Z",
  "last_completed_date": "2026-02-06",
  "execution_start_date": "2026-02-06",
  "execution_crossed_midnight": true,
  "actual_end_time": "2026-02-07T01:15:00Z"
}
```

#### 注意事項

- **排行榜快取**：使用執行開始日期作為 key
- **增量判斷**：比對 `last_completed_date` 而非 `last_updated`
- **每日摘要**：標題和檔名使用執行開始日期
- **監控檢查**：`last_checked` 使用執行開始日期

### 資料新鮮度管理

| 資料類型 | 有效期 | 過期處理 |
|---------|--------|---------|
| 排行榜快取 | 24 小時 | 重新抓取 |
| 研究報告 | 30 天 | 標記過期，依規則處理 |
| 競品清單 | 30 天 | 標記過期，依規則處理 |
| 評論萃取 | 7 天 | 可重新抓取以更新 |
| 比較分析 | 7 天 | 若有新評論則重新分析 |
| 最終報告 | 不過期 | 累積歷史版本（可追溯變化） |

#### 研究報告過期處理規則

**標記方式**：在 research.md 開頭加上 `[STALE: {過期天數}天]`

**使用規則**：

| 過期天數 | 處理 |
|---------|------|
| ≤7 天 | 直接使用 |
| 8-30 天 | 使用但在報告中標記「研究資料可能過時」 |
| >30 天 | 強制重新研究（執行 Step 5） |

**增量更新**：新產品歸入已有類別時，僅補充新產品相關研究，不重做整份研究報告

### 歷史資料保留策略

```
docs/Extractor/
├── research/
│   ├── acne-treatment--2026-02-01.md  ← 保留
│   ├── acne-treatment--2026-02-06.md  ← 最新
│   └── ...
├── amazon_us/
│   └── beauty/
│       ├── B074PVTPBW--amazon_us--2026-02-01.md  ← 保留（歷史比對用）
│       ├── B074PVTPBW--amazon_us--2026-02-06.md  ← 最新
│       └── ...
└── raw/
    └── *.jsonl  ← 依清理策略自動刪除
```

### JSONL 自動清理策略

#### 清理時機

每日執行結束時（Step 8 完成後），自動執行 JSONL 清理。

#### 清理規則

| 條件 | 處理 | 說明 |
|------|------|------|
| 已成功萃取 | 保留 7 天後刪除 | 對應 .md 檔案存在且無 `[REVIEW_NEEDED]` |
| 萃取失敗/待重試 | 保留 30 天 | 等待重試或人工處理 |
| 監控產品 | 保留 14 天 | 可能需要比對歷史數據 |
| 磁碟空間 < 1GB | 立即清理所有 > 3 天的 JSONL | 緊急清理 |

#### 清理執行邏輯

```
每日執行結束
        ↓
檢查磁碟空間
    ├── < 1GB → 執行緊急清理
    └── ≥ 1GB → 執行標準清理
        ↓
標準清理流程：
    1. 列出 docs/Extractor/*/raw/*.jsonl
    2. 對每個 JSONL：
        ├── 檢查對應 .md 是否存在且成功
        ├── 檢查是否為監控產品
        └── 根據規則決定保留或刪除
    3. 記錄清理結果到 daily_summary
```

#### 清理記錄（在 daily_summary 中）

```markdown
## JSONL 清理

| 項目 | 數量 | 釋放空間 |
|------|------|---------|
| 已清理（成功萃取 > 7 天） | 45 | 12.3 MB |
| 已清理（失敗 > 30 天） | 3 | 0.8 MB |
| 保留（監控產品） | 5 | 1.2 MB |
| 保留（待重試） | 2 | 0.5 MB |
```

#### 手動清理指令

| 指令 | 說明 |
|------|------|
| 「清理 JSONL」 | 執行標準清理 |
| 「清理 JSONL --force」 | 刪除所有 > 3 天的 JSONL（不論萃取狀態） |
| 「清理 JSONL --dry-run」 | 顯示會被清理的檔案，但不執行 |

### 每日執行 Checklist

執行前自動檢查：

| 檢查項目 | 失敗處理 |
|---------|---------|
| Amazon Session 有效 | 提示重新登入 |
| Qdrant 連線正常 | 使用本地檔案退化方案 |
| 磁碟空間 > 1GB | 清理 raw/ 目錄 |
| 網路連線正常 | 中止並提示 |

### 每日執行摘要報告（強制）

> ⚠️ **每日執行結束必須產出摘要報告**，否則視為未完成。

完成後自動產出 `docs/daily_summary/{date}.md` **並在對話中顯示摘要**：

```markdown
# 每日執行摘要 — {date}

## 執行概覽

| 指標 | 今日 | 較昨日 |
|------|------|--------|
| 執行時間 | {HH:MM} | {+/-MM} |
| 問題類別總數 | {N} | {+X 新增} |
| 產品總數 | {M} | {+Y 新增} |
| 報告總數 | {K} | {+Z 新增} |

## 今日執行統計

| 項目 | 數量 | 狀態 |
|------|------|------|
| Step 1 監控追蹤 | {N} 個產品 | ✅/⚠️ |
| Step 2 研究補齊 | {M} 個類別 | ✅/⚠️ |
| Step 3 排行榜抓取 | {K} 個新產品 | ✅ |
| Step 5 問題研究 | {L} 個類別 | ✅ |
| Step 6 評論萃取 | {P} 個產品 | ✅ |
| Step 7 比較分析 | {Q} 個類別 | ✅ |
| Step 8 報告產出 | {R} 份 | ✅ |

## 監控清單狀態

| 產品/類別 | 監控原因 | 今日狀態 | 變化 |
|-----------|---------|---------|------|
| HANYCONY Power Strip | 火災風險 | 🔴 持續監控 | 無變化 |
| Emergen-C | 品質危機 | 🟡 待觀察 | 負評率 28%→22% ⬇️ |
| squishy-toy | 研究缺口 | 🟠 暫緩發佈 | 補齊失敗 3 次 |

## 今日新發現

### 🆕 新產品警告
| 產品 | 問題 | 嚴重度 | 報告 |
|------|------|--------|------|
| {產品名} | {問題} | 🔴/🟠/🟡 | [連結] |

### 📈 排名變動（±20 名以上）
| 產品 | 變動 | 新排名 |
|------|------|--------|
| {產品} | ⬆️ +25 | #15 |

## 暫緩發佈清單

| 類別 | 原因 | 暫緩日期 | 下次重試 |
|------|------|---------|---------|
| squishy-toy | WebSearch 資料不足 | 2026-02-06 | 2026-02-13 |

## 待處理項目（需人工介入）

- [ ] 🔴 **squishy-toy**：需人工提供紓壓玩具評測網站關鍵字
- [ ] 🟠 **kids-tent**：需補充 KidKraft、Melissa & Doug 的 ASIN
- [ ] 🟡 **RELIEF SUN**：等待累積更多驗證購買評論

## 明日預期

- 監控追蹤：{N} 個產品到期需檢查
- 暫緩重試：{M} 個類別（若為週一）
- 預計新產品：約 {K} 個（根據歷史趨勢）

---
*Generated: {timestamp} | Duration: {HH:MM:SS}*
```

#### 摘要產出規則

1. **檔案輸出**：`docs/daily_summary/{YYYY-MM-DD}.md`
2. **對話顯示**：執行結束後在對話中顯示精簡版摘要
3. **異常標記**：有待處理項目時在摘要開頭加上 `⚠️ 需注意`
4. **歷史保留**：摘要檔案永久保留，用於趨勢分析

#### 精簡版摘要（對話顯示）

```
## 📊 每日摘要 — 2026-02-06

✅ 完成：20 類別分析 | 27 份報告 | 5 產品監控
⚠️ 注意：1 類別暫緩發佈 | 2 項需人工介入

### 監控狀態
- 🔴 HANYCONY：火災風險持續
- 🟡 Emergen-C：負評率改善中 (28%→22%)

### 待處理
1. squishy-toy 需人工補充關鍵字
2. kids-tent 需補充競品 ASIN

詳細報告：docs/daily_summary/2026-02-06.md
```

---

## 狀態追蹤機制

執行流程支援中斷恢復。每個 Step/子任務完成後更新狀態文件。

### 狀態文件位置

`docs/Extractor/execution_state.json`

### 格式

```json
{
  "last_updated": "2026-02-06T15:30:00Z",
  "last_completed_date": "2026-02-06",
  "execution_mode": "daily_incremental",
  "current_step": 8,
  "daily_stats": {
    "2026-02-06": {
      "new_products": 5,
      "updated_extractions": 20,
      "reports_generated": 27,
      "watchlist_checked": 3,
      "research_gaps_filled": 2
    }
  },
  "steps": {
    "step_1": {
      "status": "completed",
      "completed_at": "2026-02-06T10:00:00Z",
      "products_checked": 3,
      "changes_detected": 0
    },
    "step_2": {
      "status": "completed",
      "completed_at": "2026-02-06T10:30:00Z",
      "gaps_identified": 2,
      "gaps_filled": 2,
      "categories": ["squishy-toy", "kids-tent"]
    },
    "step_3": {
      "status": "completed",
      "completed_at": "2026-02-06T10:00:00Z",
      "products_count": 131,
      "new_products": 5
    },
    "step_4": {
      "status": "completed",
      "completed_at": "2026-02-06T11:00:00Z",
      "problem_categories": ["acne-treatment", "sleep-quality", "hair-loss"],
      "output_file": "docs/Extractor/problem_groups.md"
    },
    "step_5": {
      "status": "completed",
      "total_categories": 20,
      "completed_categories": ["acne-treatment", "sleep-quality", "..."],
      "output_files": {
        "research": "docs/Extractor/research/",
        "competitors": "docs/Extractor/competitors/"
      }
    },
    "step_6": {
      "status": "completed",
      "total_jsonl": 135,
      "completed_jsonl": ["..."]
    },
    "step_7": {
      "status": "completed",
      "categories_analyzed": 20
    },
    "step_8": {
      "status": "completed",
      "reports_generated": {
        "recommendations": 2,
        "comparisons": 14,
        "warnings": 6,
        "pain_points": 3
      }
    }
  },
  "watchlist_sync": {
    "last_sync": "2026-02-06T10:00:00Z",
    "products_monitored": 3,
    "next_check_due": ["B092J8LPWR", "B00016RL9G"]
  },
  "research_gaps": {
    "pending": ["squishy-toy"],
    "in_progress": [],
    "completed_today": ["kids-tent"]
  }
}
```

### 恢復邏輯

```
「執行完整流程」
        ↓
檢查 execution_state.json 是否存在
        ↓
    ┌───┴───┐
    │       │
  不存在   存在
    ↓       ↓
 從頭開始  讀取狀態，從中斷點繼續
```

### 狀態更新時機

| 事件 | 更新內容 |
|------|---------|
| Step 完成 | `status: completed`, `completed_at` |
| 問題類別研究完成 | `completed_categories` 新增該類別 |
| JSONL 萃取完成 | `completed_jsonl` 新增該文件 |
| 產品報告完成 | `completed_products` 新增該產品 |

### JSON 狀態文件初始化

系統使用多個 JSON 文件追蹤狀態。這些文件在**首次需要時自動創建**。

#### 文件清單與初始化時機

| 文件 | 位置 | 初始化時機 |
|------|------|-----------|
| `execution_state.json` | `docs/Extractor/` | 首次執行時 |
| `watchlist.json` | `docs/Extractor/` | 首次產出警告報告時 |
| `pending_decisions.json` | `docs/Extractor/` | 首次遇到 `[REVIEW_NEEDED]` 時 |
| `decision_log.json` | `docs/Extractor/` | 首次記錄使用者決策時 |
| `error_log.json` | `docs/Extractor/` | 首次發生錯誤時 |

#### 初始化模板

**pending_decisions.json**：
```json
{
  "last_updated": "ISO timestamp",
  "pending_decisions": []
}
```

**decision_log.json**：
```json
{
  "last_updated": "ISO timestamp",
  "decisions": [],
  "auto_rules": []
}
```

**error_log.json**：
```json
{
  "last_updated": "ISO timestamp",
  "errors": [],
  "resolved": [],
  "stats": {
    "total_errors": 0,
    "pending": 0,
    "resolved": 0,
    "by_type": {}
  }
}
```

#### 初始化檢查流程

```
執行開始
    ↓
檢查 execution_state.json 是否存在
    ├── 不存在 → 創建初始版本
    └── 存在 → 讀取並驗證格式
        ├── 格式正確 → 繼續
        └── 格式錯誤 → 備份後重建
    ↓
其他 JSON 文件在需要時動態創建
```

---

## 指定執行

| 使用者指令 | 執行範圍 |
|-----------|----------|
| 「執行完整流程」 | Step 1-8 全部執行（支援中斷恢復、每日增量） |
| 「分析 {產品名}」 | Step 4-8（指定產品，跳過排行榜抓取） |
| 「只跑發現」 | 只執行 Step 3（抓排行榜） |
| 「只跑分組」 | 只執行 Step 4（產品分組） |
| 「只跑研究」 | 只執行 Step 5（問題研究） |
| 「執行 amazon_us」 | 該 Layer 的 fetch → 萃取 → update |
| 「只跑 fetch」 | 所有 Layer 的 fetch.sh，不萃取 |
| 「只跑萃取」 | 假設 raw/ 已有 JSONL，只做萃取 + update |
| `track product {URL}` | 解析 URL → 加入 product_urls.txt + product_registry.md |
| 「只跑監控」 | 只執行 Step 1（監控清單追蹤） |
| 「只跑補齊」 | 只執行 Step 2（研究缺口補齊） |
| `watch {ASIN}` | 手動將產品加入監控清單 |
| `unwatch {ASIN}` | 從監控清單移除產品 |
| 「顯示監控清單」 | 顯示目前監控的產品和類別 |
| 「顯示今日摘要」 | 顯示今日執行統計 |

> 指定執行時模型指派規則不變。Layer 相關任務用 `sonnet`，Mode 相關任務用 `opus`。

### 單一產品分析流程

當使用者說「分析 {產品名稱}」時，執行 Step 4-8（跳過 Step 3 的排行榜抓取）：

1. 識別該產品解決什麼問題，歸入問題類別
2. 對該問題類別執行深度研究（若已有研究結果則跳過）
3. 抓取原產品評論 + L1-L6 萃取
4. 比較分析
5. 產出報告

### track product 流程

1. 解析 URL，判斷所屬平台（Amazon US/JP、YouTube Shopping 等）
2. 將 URL 加入對應 Layer 的 `product_urls.txt`
3. 從 URL 提取 product_id（ASIN 或其他識別碼）
4. 更新 `docs/product_registry.md` 對應表
5. 詢問使用者是否立即執行該 Layer 的 fetch + 萃取

---

## 環境設定

執行前需確認 `.env` 包含：

```
# Qdrant 向量資料庫
QDRANT_URL=https://xxx.cloud.qdrant.io:6333
QDRANT_API_KEY=...
QDRANT_COLLECTION=product-reviews

# OpenAI Embedding
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# Playwright（可選）
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT=30000
```

---

## 錯誤經驗記錄（流程相關）

> Amazon 爬蟲技術相關的錯誤經驗請見 `core/Extractor/Layers/amazon_us/CLAUDE.md`。

### 臨時發明機制並宣稱「會自動處理」

**錯誤**：在 Step 8 發現需要追蹤的產品問題時，臨時創建 `pending_decisions.json` 並告訴使用者「明天會自動處理」。

**後果**：
- `pending_decisions.json` 不是 CLAUDE.md 定義的標準機制
- 沒有任何 Step 會讀取此檔案
- 導致項目被遺忘，永遠不會被處理

**正確做法**：
1. **只使用 CLAUDE.md 已定義的標準機制**：
   | 需求 | 標準機制 | 觸發位置 |
   |------|---------|---------|
   | 資料不足需補齊 | `[REVIEW_NEEDED]` 標記 | Step 2 掃描 |
   | 產品需持續監控 | `watchlist.json` 直接登錄 | Step 1 讀取 |
   | 類別需補充研究 | `watchlist.json` 的 categories 欄位 | Step 2 處理 |

2. **禁止臨時發明新機制**：
   - 不可創建新的 JSON 追蹤檔案
   - 不可宣稱「會自動處理」除非確認有對應的 Step 會讀取
   - 若現有機制無法滿足需求，應先與使用者討論是否修改 CLAUDE.md

3. **發現需追蹤項目時的正確流程**：
   ```
   發現需追蹤項目
           ↓
   判斷項目類型
       ├── 安全/品質問題 → 直接加入 watchlist.json
       ├── 資料不足 → 確認報告已標記 [REVIEW_NEEDED]
       └── 新需求類型 → 詢問使用者如何處理，不可自行發明機制
   ```

**教訓**：不要為了給使用者「會處理」的安心感而承諾無法保證的事情。誠實說明限制比虛假承諾更好。

### 跳過 Step 導致狀態文件不同步

**錯誤**：從 Playwright 抓取 Bestsellers 取得新產品 ASIN 後，直接跳到 Step 6 執行萃取，跳過了 Step 4 的 `problem_groups.md` 更新。

**後果**：
- `problem_groups.md` 仍顯示舊的產品數量（132 個）
- 實際已分析 139 個產品，但文件未反映
- 造成資料不一致，使用者無法從文件了解真實狀態
- 未來的 Step 5 研究判斷（「是否已有研究」）可能出錯

**根本原因**：
- 為了「效率」而跳過標準流程中的步驟
- 認為「只是更新文件」不重要
- 沒有意識到狀態文件是系統運作的關鍵依據

**正確做法**：
1. **永遠按照 Step 1-8 順序執行**，不可跳過任何 Step
2. **每個 Step 都有其存在目的**：
   | Step | 輸出文件 | 用途 |
   |------|---------|------|
   | Step 3 | discovery_cache/{date}.json | 排行榜快取 |
   | Step 4 | problem_groups.md | 產品分組與研究狀態追蹤 |
   | Step 5 | research/*.md, competitors/*.md | 研究報告 |
   | Step 6 | {layer}/{category}/*.md | 萃取結果 |
   | Step 7 | comparisons/*.md | 比較分析 |
   | Step 8 | Narrator/*/*.md | 最終報告 |

3. **狀態文件更新檢查清單**（每次執行結束前確認）：
   ```
   □ execution_state.json — 執行狀態
   □ problem_groups.md — 產品分組（若有新產品）
   □ watchlist.json — 監控清單（若有新增/更新）
   □ daily_summary/{date}.md — 每日摘要
   ```

4. **若因特殊原因需要跳過某 Step**：
   - 必須在 execution_state.json 中記錄 `"skipped": true` 和原因
   - 必須手動執行該 Step 應產出的文件更新
   - 必須在 daily_summary 中標記哪些 Step 被跳過

**教訓**：流程中的每個步驟都有意義。跳過步驟看似節省時間，實際上會造成資料不一致，最終花更多時間修復。

### 產品頁面與評論內容不匹配（2026-02-09）

**錯誤**：萃取 B0DBRVHR38（RoC body-firming）時，產品頁面顯示「臉部精華液」，但 100% 的評論都在討論「豐唇產品」。

**後果**：
- 萃取結果完全無效（評論與產品無關）
- 浪費萃取資源
- 若未發現，會產出錯誤的分析報告

**根本原因**：
- Amazon 產品頁面可能被賣家更換（同 ASIN 換產品）
- 評論是針對舊產品，新產品頁面內容已不同
- Step 6 萃取時未驗證產品標題與評論內容的一致性

**正確做法**：
1. **Step 6 萃取時加入一致性檢查**：
   ```
   L1 商品標題 vs L3/L4 評論內容
       ├── 關鍵詞重疊率 < 20% → 標記 [REVIEW_NEEDED: product_review_mismatch]
       └── 評論提及的產品類型與標題不符 → 需人工確認
   ```

2. **發現不匹配時的處理選項**：
   | 選項 | 適用情況 |
   |------|---------|
   | 標記後保留 | 不確定是否真的不匹配 |
   | 僅保留評論資料 | 評論有價值但產品頁已變 |
   | 從類別移除 | 確定完全不匹配，資料無效 |
   | 搜尋正確 ASIN | 評論提及的產品可能有其他 ASIN |

**教訓**：Amazon ASIN 不等於固定產品。賣家可能更換產品頁面內容，導致評論與當前產品不符。萃取時應驗證一致性。

### 族群導向分組產出的報告需拆分（2026-02-09）

**錯誤**：`household-cleaning--2026-02-05.md` 使用族群導向分組（家庭清潔），包含拖把、洗衣去漬、洗碗海綿、紙巾、皮革保養、垃圾袋等不可直接比較的產品。

**後果**：
- 報告內的產品無法直接比較（拖把 vs 垃圾袋？）
- 違反 Step 4 的問題導向分組原則
- 使用者無法從報告獲得有意義的購買建議

**正確做法**：
1. **識別錯誤分組的報告**：
   - 報告內產品解決不同問題 → 錯誤分組
   - 報告標題是族群/場景而非具體問題 → 錯誤分組

2. **拆分為問題導向報告**：
   ```
   household-cleaning (錯誤)
           ↓
   拆分為：
   ├── floor-mopping（地板清潔）
   ├── laundry-stain（洗衣去漬）
   ├── dish-sponge（洗碗工具）
   ├── paper-towel（紙巾吸水）
   ├── leather-care（皮革保養）
   └── trash-bags（垃圾袋）
   ```

3. **拆分後刪除原報告**，避免重複和混淆

**教訓**：Step 4 分組規則必須嚴格執行。發現錯誤分組的舊報告時，應拆分而非直接刪除，保留已有的分析價值。

### 研究檔案版本選擇（2026-02-09）

**錯誤**：squishy-toy 有兩個研究檔案（2026-02-06 14KB、2026-02-07 38KB），差點使用舊版本。

**正確做法**：
1. **多個研究檔案時，優先使用**：
   - 日期較新的版本
   - 檔案較大的版本（通常代表更完整的研究）
   - WebFetch 次數較多的版本

2. **檢查方式**：
   ```bash
   ls -la docs/Extractor/research/{category}--*.md
   ```

3. **舊版本處理**：保留作為歷史參考，不刪除

### 推薦替代品的追蹤流程（2026-02-09）

**情境**：party-tableware 比較報告發現 Hefty Party Cups 有 32% 問題率，推薦 Hefty ECOSAVE 作為替代品。

**正確做法**：
1. **將替代品加入 product_urls.txt**：
   ```
   # === {date} 推薦替代品 ===
   https://www.amazon.com/dp/{ASIN}
   # {產品名} — {類別} (推薦替代 {原產品ASIN})
   ```

2. **在 watchlist.json 的原產品條目中標記**：
   ```json
   "recommended_alternative": {
     "asin": "{替代品ASIN}",
     "name": "{替代品名稱}",
     "added_date": "{date}",
     "status": "pending_analysis"
   }
   ```

3. **下次執行時自動分析替代品**，並與原產品比較

**教訓**：推薦替代品不應只停留在報告文字，應納入追蹤系統以便後續驗證推薦是否正確。

### 網站更新驗證（2026-02-10）

**錯誤**：執行完流程後只 commit + push，沒有驗證網站是否真的更新。

**後果**：
- `_sidebar.md` 是手動維護的檔案，不會自動更新
- 即使 `index.json` 由 GitHub Actions 自動產生，sidebar 沒更新導致新報告無法在網站上看到
- 使用者以為網站已更新，實際上新內容不可見

**正確做法**：
1. **更新 `docs/_sidebar.md`**：每次產出新報告後，必須手動更新 sidebar
   ```markdown
   * **推薦報告**
     * 2026-02-10
       * [手部乾裂護理](Narrator/recommendations/hand-care--2026-02-10.md)
   ```

2. **Commit + Push 後等待部署**：GitHub Pages 需要約 30-60 秒完成部署

3. **驗證網站更新**：
   ```bash
   # 檢查 GitHub Actions 狀態
   gh run list --limit 3

   # 用 curl 驗證（加 cache-busting 參數）
   curl -s "https://weiqi-kids.github.io/agent.ecommerce-product-review/_sidebar.md?v=$(date +%s)" | head -30
   ```

4. **確認報告可存取**：實際 WebFetch 報告頁面確認內容正確

**教訓**：任務不是 push 完就結束，必須親自驗證網站更新才算完成。

---

## 輸出規則

### 格式遵循

- Layer 萃取 .md 遵循 `core/Extractor/CLAUDE.md` 的 L1-L6 模板
- Mode 報告 .md 遵循各 Mode CLAUDE.md 的輸出框架
- 所有輸出必須通過各自的「自我審核 Checklist」
- 未通過審核 → 在 .md 開頭加上 `[REVIEW_NEEDED]`
- `index.json` 由 GitHub Actions（`build-index.yml`）自動產生，不在此流程處理

### `[REVIEW_NEEDED]` 規範

| 概念 | 含義 |
|------|------|
| `[REVIEW_NEEDED]` | 萃取結果**可能有誤**，需人工確認 |
| `confidence: 低` | 資料有**結構性限制**（如單一來源），不代表有誤 |

> **兩者不等價。** 子任務不可自行擴大判定範圍。

通用觸發條件（各 Layer CLAUDE.md 可新增平台特有規則）：
1. 爬蟲取回少於 10 則評論
2. 商品標題與 registry 不符 >30%
3. 偵測到語言不符（如 US listing 出現大量非英文評論）
4. 聲明驗證發現直接矛盾
5. 同商品跨平台情感分數差異 >0.5
6. 同商品跨店家價格差異 >50%

**不觸發**（用 confidence 反映）：僅單一平台、評論少但 ≥10、缺少 UPC/EAN。

### 多語言策略

- **Scraper 層**：按平台語系抓取（amazon_us 抓英文）
- **萃取層**：aspect 名稱統一用英文，引述保留原文
- **Narrator 層**：報告用繁體中文產出，保留原文引述

### 禁止行為

1. 不可產出無來源的聲明
2. 不可跳過自我審核 Checklist
3. 不可混淆推測與事實
4. 不可自行新增 category enum 值（須與使用者確認）
5. 不可用 Read 工具讀取 `.jsonl`（一律 `sed -n` 逐行）
6. 不可自行擴大 `[REVIEW_NEEDED]` 判定範圍
7. 不可將評論分析結果當作客觀事實（須標明「基於評論的分析」）
8. 不可忽略評論可能的偽造或操縱風險（異常模式應標記）

---

## 互動規則

### 執行結束必做事項（強制）

「執行完整流程」結束時，**必須**依序完成以下事項：

```
Step 8 完成
    ↓
1. 更新 watchlist.json（新增監控產品/更新狀態）
    ↓
2. 更新 execution_state.json（記錄完成狀態）
    ↓
3. 產出每日摘要 docs/daily_summary/{date}.md
    ↓
4. 在對話中顯示精簡版摘要
    ↓
5. 更新 README.md 健康度儀表板
    ↓
6. 更新 docs/_sidebar.md（加入新報告連結）
    ↓
7. 更新 docs/README.md 首頁（更新「最新報告」區塊）
    ↓
8. Git commit + push（觸發 GitHub Actions 更新網站）
    ↓
9. 驗證網站更新（curl + WebFetch 確認內容可見）
    ↓
執行完成 ✅
```

> ⚠️ **未完成以上事項視為執行未完成**，下次執行時會從中斷點繼續。
> ⚠️ **步驟 6-9 特別重要**：
> - `_sidebar.md` 是手動維護的，不更新則新報告在側邊欄不可見
> - `README.md` 首頁的「最新報告」區塊也需手動更新
> - 必須親自驗證網站更新，不能假設 push 後就完成

### 執行回報

完成執行後簡要回報：

1. 各 Layer 擷取與萃取結果（筆數、有無 REVIEW_NEEDED）
2. 各 Mode 報告產出狀態
3. 錯誤或需人工介入的項目
4. **監控清單變化**
5. **暫緩發佈項目**

### 健康度儀表板

執行完整流程後更新 `README.md` 健康度表格：

| Layer | 最後更新 | 商品數 | 評論數 | 狀態 |
|-------|----------|--------|--------|------|
| {name} | {YYYY-MM-DD} | {N} | {M} | ✅/⚠️/❌ |

| Mode | 最後產出 | 狀態 |
|------|----------|------|
| {name} | {YYYY-MM-DD} | ✅/⚠️/❌ |

判定規則：
- ✅ 正常：最後更新在預期週期內
- ⚠️ 需關注：超過預期但未超過 2 倍
- ❌ 異常：超過 2 倍以上

---

## 每日執行注意事項

### 潛在問題與解決方案

| 問題 | 症狀 | 解決方案 |
|------|------|---------|
| Amazon Session 過期 | 評論抓取返回 0 則 | 執行 `npx tsx src/amazon/scraper.ts --login` |
| Rate Limit | WebSearch 失敗 | 減少平行數、增加延遲 |
| 排行榜無變化 | 連續多日無新產品 | 正常現象，繼續監控即可 |
| 研究補齊無法完成 | 某類別持續標記 REVIEW_NEEDED | 人工介入補充關鍵字 |
| 監控產品下架 | ASIN 返回 404 | 執行下架處理流程（見下方） |
| 磁碟空間不足 | 寫入失敗 | 清理 `docs/Extractor/raw/*.jsonl` |
| 報告產出重複 | 同一產品多份報告 | 檢查 Step 5-6 去重邏輯 |

### 監控產品下架判斷

#### 下架偵測條件

| 偵測方式 | 判定 | 說明 |
|---------|------|------|
| HTTP 404 | 確定下架 | 商品頁返回 404 |
| HTTP 503 | 暫時不可用 | 重試 3 次後標記 |
| 「目前無法購買」 | 可能下架 | 連續 3 天偵測到則判定下架 |
| 「商品已停止販售」 | 確定下架 | 立即判定 |
| 評論頁無評論 | Session 問題 | 非下架，檢查登入狀態 |

#### 下架處理流程

```
抓取商品時偵測到下架信號
        ↓
判斷下架類型
    ├── 確定下架（404 / 停止販售）
    │   ├── 記錄到 error_log.json（error_type: product_unavailable）
    │   ├── 從 watchlist.json 移除（或標記 status: delisted）
    │   ├── 更新警告報告（標記產品已下架）
    │   └── 在每日摘要中列出
    │
    └── 可能下架（暫時不可用 / 無法購買）
        ├── 記錄首次偵測時間
        ├── 連續 3 天偵測到 → 判定為確定下架
        └── 恢復可購買 → 清除下架標記
```

#### watchlist.json 下架產品標記

```json
{
  "asin": "B074PVTPBW",
  "name": "Product Name",
  "status": "delisted",
  "delisted_at": "2026-02-06",
  "delisted_reason": "HTTP 404",
  "last_valid_report": "docs/Narrator/warnings/B074PVTPBW--2026-02-05.md"
}
```

#### 下架產品報告處理

已發佈的報告不刪除，而是在報告開頭加上：

```markdown
> ⚠️ **產品已下架**（2026-02-06 偵測）
> 此報告保留供參考，但產品已無法購買。
```

### 長期維護建議

1. **每週**：檢查監控清單，移除已解決問題的產品
2. **每月**：清理超過 30 天的 JSONL 原始檔
3. **每月**：審核 `[REVIEW_NEEDED]` 報告，決定是否人工補充
4. **每季**：審核問題類別分組，合併或拆分類別

### 效能最佳化建議

| 優化項目 | 說明 | 預期效果 | 狀態 |
|---------|------|---------|------|
| Discovery JSONL | discovery.ts 輸出 JSONL 含產品名稱，Step 4 直接使用 | 減少 Step 4 WebSearch | ✅ 已實作 |
| WebFetch 快取 | 對相同 URL 的 WebFetch 進行快取（15 分鐘） | 減少 30% 請求 | ✅ 內建 |
| 增量萃取 | 僅萃取新評論，合併舊結果 | 減少 50% 萃取時間 | ⏳ 待實作 |
| 背景任務 | 長時間任務使用 `run_in_background` | 不阻塞主流程 | ✅ 可用 |
| 批次寫入 | 多個小檔案合併寫入 | 減少 I/O 開銷 | ⏳ 待實作 |
| JSONL 快取 | 同日已抓取的 ASIN 跳過重複抓取 | 減少重複爬取 | ✅ 已實作 |

#### Discovery JSONL 格式

`discovery.ts --output` 輸出 JSONL 格式，每行包含：

```json
{"asin":"B074PVTPBW","title":"Mighty Patch Original","rank":1,"price":"$12.99","rating":"4.5","review_count":"50000","source":"bestsellers","category":"beauty","url":"https://www.amazon.com/dp/B074PVTPBW"}
```

Step 4 分組時直接讀取 `title` 欄位判斷問題類別，減少對每個產品的 WebSearch 查詢。

#### JSONL 快取機制

Step 6 抓取前檢查 `docs/Extractor/discovery_cache/{date}.json`：

```bash
# 檢查今日是否已抓取該 ASIN
jq -e '.products[] | select(.asin == "B074PVTPBW")' docs/Extractor/discovery_cache/$(date +%Y-%m-%d).json
```

- 已存在 → 跳過抓取，使用快取
- 不存在 → 正常抓取，完成後加入快取

### 錯誤恢復機制

```
執行中發生錯誤
        ↓
自動儲存當前狀態到 execution_state.json
        ↓
記錄錯誤到 docs/Extractor/error_log.json
        ↓
下次執行時：
    ├── 讀取 error_log.json
    ├── 顯示上次錯誤摘要
    ├── 詢問：重試失敗任務 / 跳過 / 中止
    └── 根據選擇繼續執行
```

#### error_log.json 格式

```json
{
  "last_updated": "2026-02-06T15:30:00Z",
  "errors": [
    {
      "id": "err-20260206-001",
      "timestamp": "2026-02-06T14:23:45Z",
      "step": 6,
      "task_type": "fetch",
      "target": "B074PVTPBW",
      "error_type": "network_timeout",
      "message": "Request timeout after 60000ms",
      "retry_count": 2,
      "status": "pending",
      "context": {
        "layer": "amazon_us",
        "category": "acne-treatment",
        "url": "https://www.amazon.com/dp/B074PVTPBW"
      }
    }
  ],
  "resolved": [
    {
      "id": "err-20260205-003",
      "resolved_at": "2026-02-06T10:00:00Z",
      "resolution": "retry_success"
    }
  ],
  "stats": {
    "total_errors": 15,
    "pending": 1,
    "resolved": 14,
    "by_type": {
      "network_timeout": 5,
      "rate_limit": 8,
      "parse_error": 2
    }
  }
}
```

**錯誤類型（error_type）**：

| 類型 | 說明 | 預設處理 |
|------|------|---------|
| `network_timeout` | 網路請求超時 | 自動重試 2 次 |
| `rate_limit` | 頻率限制（429） | 等待後重試 |
| `session_expired` | Amazon Session 過期 | 提示重新登入 |
| `parse_error` | HTML/JSON 解析失敗 | 記錄並跳過 |
| `write_error` | 檔案寫入失敗 | 檢查磁碟空間 |
| `qdrant_error` | 向量資料庫錯誤 | 使用退化方案 |
| `product_unavailable` | 產品下架/不存在 | 標記並跳過 |

**錯誤狀態（status）**：

| 狀態 | 說明 |
|------|------|
| `pending` | 待處理（下次執行時詢問） |
| `retrying` | 重試中 |
| `resolved` | 已解決（移至 resolved 陣列） |
| `skipped` | 使用者選擇跳過 |
| `manual` | 需人工處理 |

### 資料一致性檢查

每日執行結束前，自動檢查資料一致性：

| 檢查項目 | 預期 | 失敗處理 |
|---------|------|---------|
| 每個類別都有 research.md | 是 | 標記補齊 |
| 每個類別都有 competitors.md | 是 | 標記補齊 |
| 每個產品都有萃取結果 | 是 | 重新抓取 |
| 每個類別都有 Step 7 分析 | 是 | 重新分析 |
| 每個類別都有最終報告 | 是 | 重新產出 |
| watchlist.json 格式正確 | 是 | 修復或重建 |
| execution_state.json 完整 | 是 | 修復或重建 |
