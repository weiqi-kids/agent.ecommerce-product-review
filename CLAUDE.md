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
Step 8: 產出報告（類型依分析結果，不可跳過）
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
| 新產品 → 已有類別 | 加入該類別，跳過 Step 5，**執行 Step 6-8（萃取 + 比較 + 更新報告）** |
| 新產品 → 新類別 | 建立新類別，執行完整 Step 5-8 |
| 無新產品 | 跳過 Step 4-8（僅執行 Step 1-2） |

> ⚠️ **有萃取就有報告**：只要 Step 6 有新萃取，Step 7-8 必須執行。

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

**輸出**：`docs/Extractor/problem_groups.md`（格式見現有檔案）

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

**完整重新研究觸發條件**：
- 研究報告過期（> 30 天）
- 超過 50% 競品標記 `[STALE]` 或 `[DELISTED]`
- 使用者手動指令「重新研究 {類別}」

**輸出**：
- `docs/Extractor/research/{問題類別}--{date}.md`（研究報告）
- `docs/Extractor/competitors/{問題類別}--{date}.md`（競品清單）

> 格式範例見現有檔案。

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

### Step 8: 產出報告（類型依分析結果）

> ⚠️ **Step 8 不可跳過**：只要 Step 7 執行了比較分析，就必須產出對應報告。
> 「條件性」指的是**報告類型**（推薦/比較/警告/痛點），不是**是否產出**。

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

> 詳細說明見 `core/Architect/CLAUDE.md`。

| 判斷條件 | 執行模式 |
|---------|---------|
| `last_completed_date` = 今日 | 增量模式 |
| `last_completed_date` = 昨日 | 標準每日更新 |
| `last_completed_date` > 1 天前 | 完整重跑 |

### 資料新鮮度

| 資料類型 | 有效期 |
|---------|--------|
| 排行榜快取 | 24 小時 |
| 研究報告 | 30 天 |
| 評論萃取 | 7 天 |
| 最終報告 | 不過期 |

### 每日執行摘要（強制）

> ⚠️ 執行結束必須產出 `docs/daily_summary/{date}.md`，否則視為未完成。

---

## 狀態追蹤機制

> 詳細說明見 `core/Architect/CLAUDE.md`。

狀態文件：`docs/Extractor/execution_state.json`

```json
{
  "last_updated": "ISO timestamp",
  "last_completed_date": "YYYY-MM-DD",
  "execution_mode": "daily_incremental",
  "current_step": 1-8,
  "steps": { ... }
}
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

### MCP Server 配置

本系統使用 [Fetcher MCP](https://github.com/jae-jae/fetcher-mcp) 進行網頁抓取，支援 JavaScript 渲染。

**已安裝的 MCP Server**：

| Server | 功能 | 指令 |
|--------|------|------|
| `fetcher` | 網頁抓取（Playwright） | `npx -y fetcher-mcp` |

**提供的 MCP 工具**：

| 工具 | 說明 | 用途 |
|------|------|------|
| `fetch_url` | 抓取單一 URL，回傳 Markdown | Step 5 WebFetch 替代方案 |
| `fetch_urls` | 批次抓取多個 URL | 提升抓取效率 |

**管理指令**：

```bash
# 查看已安裝的 MCP server
claude mcp list

# 移除 MCP server
claude mcp remove fetcher

# 重新安裝
claude mcp add fetcher -- npx -y fetcher-mcp
```

**優點**（相比 WebFetch）：
- 不需要每次授權確認
- 支援 JavaScript 渲染
- 可批次抓取多個 URL

---

## 錯誤經驗記錄

> 詳細記錄見 `docs/error_experiences.md`。
> Amazon 爬蟲技術相關請見 `core/Extractor/Layers/amazon_us/CLAUDE.md`。

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

### 側邊欄視圖管理

網站側邊欄支援 3 種視圖模式，用戶可通過頂部按鈕切換：

| 視圖 | 檔案 | 說明 | emoji |
|------|------|------|-------|
| 按時間 | `_sidebar.md` | 每日更新一目了然 | 📅 |
| 按類別 | `_sidebar-category.md` | 找特定產品類別 | 📁 |
| 按類型 | `_sidebar-type.md` | 警告/推薦/比較/痛點 | 📋 |

**更新規則**：
- 每次產出新報告時，**必須同時更新 3 個 sidebar 檔案**
- 按時間視圖：新報告加入對應日期區塊，emoji 標示類型（⚠️/✅/⚖️/📊/🚨）
- 按類別視圖：新報告加入對應類別區塊
- 按類型視圖：新報告加入對應類型區塊

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
6. 更新 3 個 sidebar 檔案（加入新報告連結）
    ├── docs/_sidebar.md（按時間）
    ├── docs/_sidebar-category.md（按類別）
    └── docs/_sidebar-type.md（按類型）
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
> - **必須更新全部 3 個 sidebar 檔案**，否則某些視圖會缺少新報告
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

> 詳細說明見 `core/Architect/CLAUDE.md`。

### 常見問題

| 問題 | 解決方案 |
|------|---------|
| Session 過期 | `npx tsx src/amazon/scraper.ts --login` |
| Rate Limit | 減少平行數 |
| 產品下架 | 標記 status: delisted |
| 磁碟空間不足 | 清理 raw/*.jsonl |

### 長期維護

| 頻率 | 任務 |
|------|------|
| 每週 | 檢查監控清單 |
| 每月 | 清理 > 30 天 JSONL |
| 每季 | 審核問題分組 |
