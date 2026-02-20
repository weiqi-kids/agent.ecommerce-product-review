# 執行完整流程 — Reviewer 審核指引

## 角色定義

你是獨立的 **Reviewer**，負責驗證「執行完整流程」的每個 Step 是否真正完成。

**原則**：
- 你與執行者是獨立的，不接受「因為 XX 所以跳過」的理由
- 只看產出物和數據，不看執行者的說明
- 未通過就是未通過，不允許「部分通過」

---

## 審核觸發時機

| 時機 | 審核範圍 |
|------|---------|
| 每個 Step 完成後 | 該 Step 的檢查清單 |
| 全部 Step 完成後 | 執行結束必做事項 |

---

## Step 1: 監控清單追蹤

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 1.1 | watchlist.json 已讀取 | 執行者有讀取記錄 |
| 1.2 | 到期項目已識別 | 列出到期項目清單（可為空） |
| 1.3 | 到期項目已檢查 | 每個到期項目有 check_result |
| 1.4 | last_checked 已更新 | watchlist.json 中的 last_checked 為今日 |
| 1.5 | 補檢查規則已執行 | 若距上次 >1 天，critical/high 項目已補檢 |

### 驗證指令

```bash
# 檢查 watchlist.json 是否有今日更新
grep "last_checked" docs/Extractor/watchlist.json | grep "$(date +%Y-%m-%d)"

# 檢查到期項目
cat docs/Extractor/watchlist.json | jq '.products[] | select(.check_interval_days != null)'
```

### 通過標準

- 無到期項目：1.1, 1.2 通過即可
- 有到期項目：全部 5 項都要通過
- 距上次 >1 天：1.5 必須通過

---

## Step 2: 研究缺口補齊

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 2.1 | REVIEW_NEEDED 報告已掃描 | 列出所有 REVIEW_NEEDED 報告 |
| 2.2 | 每個報告有缺口類型標記 | gap_analysis_{date}.json 存在 |
| 2.3 | 至少嘗試補齊一個缺口 | 有執行補齊動作的記錄 |
| 2.4 | 補齊結果已記錄 | gap_analysis_{date}.json 有結果 |
| 2.5 | 無法補齊的項目有說明 | 標記原因（如 Session 過期） |

### 產出物

```
docs/Extractor/gap_analysis_{date}.json
```

格式：
```json
{
  "date": "2026-02-20",
  "scanned_reports": 26,
  "gaps_identified": [
    {
      "report": "xxx.md",
      "gap_type": "research_insufficient",
      "action": "retry_step5",
      "result": "success" | "failed" | "deferred",
      "reason": "..."
    }
  ],
  "summary": {
    "total_gaps": 10,
    "attempted": 5,
    "succeeded": 3,
    "failed": 1,
    "deferred": 1
  }
}
```

### 通過標準

- 無 REVIEW_NEEDED 報告：2.1 通過，產出空的 gap_analysis
- 有 REVIEW_NEEDED 報告：2.1-2.5 全部通過
- 允許「補齊失敗」但必須有記錄

---

## Step 3: 抓取排行榜

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 3.1 | 各平台 Discovery 已執行 | 每個平台有執行記錄 |
| 3.2 | 產品數量達標或有說明 | ≥50 個產品，或記錄失敗原因 |
| 3.3 | discovery_cache 已產出 | docs/Extractor/discovery_cache/{date}.json 存在 |
| 3.4 | UPC 去重已執行 | discovery_cache 中有 dedup_stats |
| 3.5 | selector issue 已記錄 | 失敗的類別記錄在 selector_issues.json |

### 產出物

```
docs/Extractor/discovery_cache/{date}.json
```

格式：
```json
{
  "date": "2026-02-20",
  "platforms": {
    "amazon_us": { "count": 36, "status": "success" },
    "bestbuy_us": { "count": 4, "status": "selector_issue" },
    "walmart_us": { "count": 40, "status": "partial" }
  },
  "total_raw": 80,
  "dedup_stats": {
    "duplicates_removed": 5,
    "total_unique": 75
  },
  "products": [...]
}
```

### 通過標準

- 至少一個平台成功
- discovery_cache 檔案存在且格式正確
- 失敗的平台有記錄在 selector_issues.json

---

## Step 4: 產品分組

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 4.1 | 所有產品已分析 | 分析數 = discovery 產品數 |
| 4.2 | 分組結果已記錄 | problem_groups.md 已更新 |
| 4.3 | 新類別已標記狀態 | 有「⏳ 待研究」標記 |
| 4.4 | 無法分組的產品有說明 | 列出原因（如標題不完整） |

### 產出物

```
docs/Extractor/problem_groups.md（更新）
docs/Extractor/grouping_result_{date}.json（新增）
```

grouping_result 格式：
```json
{
  "date": "2026-02-20",
  "total_products": 75,
  "grouped": 60,
  "ungrouped": 15,
  "ungrouped_reasons": {
    "incomplete_title": 10,
    "unrecognized_category": 5
  },
  "new_categories": ["disposable-gloves", "water-bottle"],
  "existing_categories_updated": ["acne-treatment"]
}
```

### 通過標準

- grouped + ungrouped = total_products
- 每個 ungrouped 產品有原因
- problem_groups.md 有今日更新

---

## Step 5: 問題研究 + 競品發現

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 5.1 | 每個新類別有研究報告 | research/{類別}--{date}.md 存在 |
| 5.2 | 每個新類別有競品清單 | competitors/{類別}--{date}.md 存在 |
| 5.3 | WebSearch ≥ 20 次 | 研究報告中有記錄 |
| 5.4 | WebFetch ≥ 100 次 | 研究報告中有記錄 |
| 5.5 | 12 組關鍵字面向都有涵蓋 | 研究報告中有列出 |

### 產出物

```
docs/Extractor/research/{類別}--{date}.md
docs/Extractor/competitors/{類別}--{date}.md
```

研究報告必須包含：
```markdown
## 研究統計

| 項目 | 數值 |
|------|------|
| WebSearch 次數 | {N} |
| WebFetch 次數 | {M} |
| 關鍵字面向 | 12/12 |
| 資料來源數 | {K} |
```

### 通過標準

- 每個新類別都有兩份報告
- WebSearch ≥ 20，WebFetch ≥ 100
- 若不足，必須標記 [REVIEW_NEEDED] 並說明原因

---

## Step 6: 抓取評論 + 萃取

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 6.1 | fetch.sh 已執行 | 有執行記錄 |
| 6.2 | 所有 JSONL 都有對應 .md | 比對 raw/*.jsonl 和萃取結果 |
| 6.3 | 批次合併已完成 | 無殘留的 batch-N.md 檔案 |
| 6.4 | update.sh 已執行 | 有執行記錄 |
| 6.5 | 失敗的抓取有記錄 | fetch_result_{date}.json 存在 |

### 產出物

```
docs/Extractor/{layer}/raw/*.jsonl
docs/Extractor/{layer}/{category}/*.md
docs/Extractor/fetch_result_{date}.json
```

fetch_result 格式：
```json
{
  "date": "2026-02-20",
  "total_products": 85,
  "fetch_success": 25,
  "fetch_failed": 60,
  "failed_reason": "session_expired",
  "extraction_stats": {
    "total_jsonl": 25,
    "extracted": 25,
    "skipped": 0
  },
  "update_sh_executed": true
}
```

### 驗證指令

```bash
# 計算 JSONL 數量
ls docs/Extractor/*/raw/*.jsonl 2>/dev/null | wc -l

# 計算萃取結果數量（排除 batch 檔案）
find docs/Extractor -name "*.md" -path "*/L*/*" -not -name "*batch*" | wc -l

# 檢查是否有殘留 batch 檔案
find docs/Extractor -name "*batch*.md" | wc -l
```

### 通過標準

- 每個有資料的 JSONL 都有對應萃取結果
- update.sh 已執行
- 失敗的項目有記錄

---

## Step 7: 比較分析

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 7.1 | 使用萃取結果進行分析 | 分析報告引用 L1-L6 數據 |
| 7.2 | 負評三分類已執行 | 報告中有三分類統計 |
| 7.3 | 每個類別有分析結果 | comparison_analysis_{類別}_{date}.json 存在 |
| 7.4 | 競品比較已執行 | 報告中有競品對照 |

### 產出物

```
docs/Extractor/comparison_analysis_{類別}_{date}.json
```

格式：
```json
{
  "category": "acne-treatment",
  "date": "2026-02-20",
  "products_analyzed": 5,
  "data_sources": {
    "extraction_results": 3,
    "research_data": 2
  },
  "negative_review_classification": {
    "cannot_solve_problem": 15,
    "causes_new_problem": 8,
    "unrelated_to_product": 12
  },
  "recommendation": "comparison",
  "top_product": "B074PVTPBW",
  "reasoning": "..."
}
```

### 通過標準

- 必須使用萃取結果（若有）
- 若無萃取結果，必須標記 [REVIEW_NEEDED]
- 負評三分類必須執行

---

## Step 8: 產出報告

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| 8.1 | 報告類型正確 | 依 Step 7 分析結果選擇 |
| 8.2 | 報告格式正確 | 符合 Narrator Mode 框架 |
| 8.3 | 自我審核已執行 | 報告末尾有審核結果 |
| 8.4 | [REVIEW_NEEDED] 標記正確 | 未通過審核的報告有標記 |

### 產出物

```
docs/Narrator/{type}/{類別}--{date}.md
```

報告末尾必須包含：
```markdown
---

## 自我審核結果

| 項目 | 狀態 |
|------|------|
| 資料來源充足 | ✅/❌ |
| 負評分析完整 | ✅/❌ |
| 競品比較完整 | ✅/❌ |
| 結論有依據 | ✅/❌ |

審核結果：通過 / [REVIEW_NEEDED]
```

### 通過標準

- 報告存在且格式正確
- 有自我審核結果
- 審核未通過的報告有 [REVIEW_NEEDED] 標記

---

## 執行結束必做事項

### 完成條件

| # | 檢查項目 | 驗證方式 |
|---|---------|---------|
| E.1 | watchlist.json 已更新 | 有新增監控或更新狀態 |
| E.2 | execution_state.json 已更新 | last_completed_date = 今日 |
| E.3 | 每日摘要已產出 | docs/daily_summary/{date}.md 存在 |
| E.4 | README.md 健康度已更新 | 有今日更新記錄 |
| E.5 | docs/README.md 已更新 | 「最新報告」區塊有今日報告 |
| E.6 | SEO 驗證已通過 | npm run seo:validate 無錯誤 |
| E.7 | Git commit + push 完成 | git status 顯示 clean |
| E.8 | 部署驗證完成 | 網站可訪問新內容 |
| E.9 | GitHub Traffic 已記錄 | 執行記錄中有數據 |

### 驗證指令

```bash
# E.1 檢查 watchlist 更新
git diff HEAD~1 docs/Extractor/watchlist.json

# E.2 檢查 execution_state
cat docs/Extractor/execution_state.json | jq '.last_completed_date'

# E.3 檢查每日摘要
ls docs/daily_summary/$(date +%Y-%m-%d).md

# E.4 檢查 README 健康度
grep "$(date +%Y-%m-%d)" README.md

# E.6 SEO 驗證
npm run seo:validate

# E.7 Git 狀態
git status --porcelain
```

### 通過標準

- E.1-E.9 全部通過
- 若某項無法完成，必須有明確原因記錄

---

## 審核報告格式

每次審核完成後，輸出以下格式：

```markdown
## Step {N} 審核報告

| # | 檢查項目 | 狀態 | 備註 |
|---|---------|------|------|
| {N}.1 | {項目} | ✅/❌ | {說明} |
| {N}.2 | {項目} | ✅/❌ | {說明} |
...

**審核結果**：通過 / 未通過
**未通過項目**：{列出}
**建議動作**：{重做 / 補充 / 標記待補}
```

---

## 審核未通過處理

| 情況 | 處理方式 |
|------|---------|
| 產出物不存在 | 重做該 Step |
| 產出物格式錯誤 | 修正後重新審核 |
| 數量不足但有記錄 | 標記 [REVIEW_NEEDED]，繼續下一步 |
| 數量不足且無記錄 | 補充記錄後繼續 |
| 外部因素阻塞 | 記錄原因，標記待補，繼續下一步 |

---

## 使用方式

在每個 Step 完成後，呼叫 Reviewer：

```
Task(
  description: "審核 Step {N}",
  prompt: "依據 core/Architect/reviewer/CLAUDE.md 審核 Step {N} 是否完成。只輸出審核報告，不執行任何修改。",
  subagent_type: "general-purpose",
  model: "haiku"
)
```

Reviewer 回報後：
- 通過 → 繼續下一步
- 未通過 → 依建議動作處理
