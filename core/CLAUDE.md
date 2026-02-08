# 系統維護指令

本檔案在 `core/` 目錄下操作時由 Claude CLI 自動載入。

## 維護操作

### Layer 管理

#### 新增 Layer

1. 與使用者確認 Layer 定義表
2. 確認平台特有的萃取注意事項
3. 確認 `[REVIEW_NEEDED]` 觸發規則
4. 建立目錄結構：
   - `core/Extractor/Layers/{layer_name}/` — CLAUDE.md, fetch.sh, update.sh, product_urls.txt
   - `docs/Extractor/{layer_name}/raw/` — 原始資料
   - `docs/Extractor/{layer_name}/{category}/` — 每個品類子目錄
5. 若需要新的 scraper，建立 `scrapers/src/{platform}/`
6. 更新 `docs/explored.md`「已採用」表格
7. 更新 `docs/product_registry.md`（若有初始追蹤商品）

#### 修改 Layer

1. 讀取 `core/Extractor/Layers/{layer_name}/CLAUDE.md` 確認現況
2. 與使用者確認修改內容
3. 修改對應檔案
4. 若 category enum 有變動，確認不會影響既有 docs 分類
5. 列出影響範圍（哪些 Mode 會受影響）

#### 刪除 / 暫停 Layer

- 刪除前列出依賴此 Layer 的所有 Mode，警告影響範圍
- 暫停：在 Layer 目錄建立 `.disabled` 標記檔
- 執行流程會自動跳過帶有 `.disabled` 的 Layer

### Mode 管理

與 Layer 管理邏輯類似，在 `core/Narrator/Modes/` 下操作。

### 資料源管理

使用者說：「我找到一個新的資料源 {URL}」

1. 測試連線（curl 確認可達）
2. 判斷平台類型
3. 更新 `docs/explored.md`「評估中」表格
4. 詢問使用者要建立新 Layer 還是加入現有 Layer

### Product Registry 管理

`docs/product_registry.md` 維護商品跨平台對應：
- 使用者說「track product {URL}」→ 解析 URL 後加入對應 Layer 的 product_urls.txt 和 registry
- 手動編輯 registry 時確保 product_id 一致性

### 監控清單管理

`docs/Extractor/watchlist.json` 維護需持續追蹤的產品與類別：

#### 產品監控

| 操作 | 說明 |
|------|------|
| 自動加入 | Step 8 產出警告報告時，自動將產品加入監控 |
| 手動加入 | 使用者說 `watch {ASIN}` |
| 移除監控 | 使用者說 `unwatch {ASIN}`，或問題已解決時 |

#### 類別監控（研究缺口）

| 操作 | 說明 |
|------|------|
| 自動加入 | 報告標記 `[REVIEW_NEEDED]` 且原因為研究/競品/評論不足 |
| 自動移除 | 補齊成功後 |
| 暫緩發佈 | 連續 3 次補齊失敗，移至 `deferred_categories` |

#### watchlist.json 結構

```json
{
  "last_updated": "ISO timestamp",
  "products": [
    {
      "asin": "ASIN",
      "name": "產品名稱",
      "category": "問題類別",
      "watch_reason": "fire_hazard | quality_crisis | design_flaw | product_integrity | review_anomaly",
      "severity": "critical | high | medium",
      "added_date": "YYYY-MM-DD",
      "last_checked": "YYYY-MM-DD",
      "check_interval_days": 7,
      "alerts": [{"type": "alert_type", "description": "描述"}],
      "baseline": {"metric": "value"}
    }
  ],
  "categories": [
    {
      "name": "類別名",
      "watch_reason": "research_gap",
      "action": "supplement_research | supplement_competitors",
      "notes": "說明"
    }
  ],
  "deferred_categories": [
    {
      "name": "類別名",
      "deferred_date": "YYYY-MM-DD",
      "attempts": 3,
      "reason": "補齊失敗原因",
      "next_retry": "YYYY-MM-DD",
      "manual_action_needed": "需人工執行的動作"
    }
  ]
}
```

### 每日摘要管理

`docs/daily_summary/{YYYY-MM-DD}.md` 每日執行結束時自動產出：
- 執行統計
- 監控清單變化
- 新發現警告
- 暫緩發佈項目
- 待處理項目

> 每日摘要為**強制產出**，未產出視為執行未完成。

### 決策管理

#### 待決策佇列

`docs/Extractor/pending_decisions.json` 記錄未通過審核的報告，等待使用者決策：

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

#### 決策記錄

`docs/Extractor/decision_log.json` 記錄使用者的歷史決策，用於漸進式自動化：

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

**漸進式自動化規則**：
- 同一原因類型累積 ≥5 次相同決策 → 自動套用該決策
- 自動決策會在摘要中標註 `[AUTO]`
- 使用者可隨時覆寫自動化決策

### 錯誤記錄管理

`docs/Extractor/error_log.json` 記錄執行過程中的錯誤，用於恢復和重試：

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
      "status": "pending"
    }
  ],
  "resolved": [],
  "stats": {}
}
```

**錯誤狀態**：`pending` | `retrying` | `resolved` | `skipped` | `manual`

**錯誤類型**：`network_timeout` | `rate_limit` | `session_expired` | `parse_error` | `write_error` | `qdrant_error` | `product_unavailable`

## 品類 Enum（共用）

品類定義在 `core/Extractor/CLAUDE.md`，所有 Layer 共用：

```
electronics, home_appliance, beauty, health, toys_games,
sports_outdoor, fashion, food_beverage, pet, baby, automotive, other
```

> **嚴格限制：category 只能使用定義的英文值，不可自行新增。** 需要新增 category 時必須與使用者確認後寫入 `core/Extractor/CLAUDE.md`。
