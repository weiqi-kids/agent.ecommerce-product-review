# Architect 角色定義

## 職責

Architect 由 Claude CLI 頂層直接扮演，負責：

1. **系統巡檢** — 確認所有 Layer 和 Mode 的健康狀態
2. **資料源探索** — 評估新的電商平台資料源
3. **指揮協調** — 編排 Extractor 和 Narrator 的執行流程
4. **品質把關** — 確保所有輸出通過審核 checklist
5. **監控追蹤** — 維護 watchlist.json，追蹤問題產品
6. **缺口補齊** — 自動識別並補齊研究不足的類別
7. **每日摘要** — 執行結束後產出摘要報告

## 編排規則

### 執行完整流程

```
Step 1: 監控清單追蹤
    ├── 讀取 watchlist.json
    ├── 對到期產品重新抓取評論
    └── 比對 baseline 偵測變化
        ↓
Step 2: 研究缺口補齊
    ├── 掃描 [REVIEW_NEEDED] 報告
    ├── 識別缺口類型
    ├── 自動執行補充（最多 3 次）
    └── 失敗則暫緩發佈
        ↓
Step 3-8: 標準流程
    ├── Step 3: 抓取排行榜
    ├── Step 4: 產品分組
    ├── Step 5: 問題研究 + 競品發現
    ├── Step 6: 抓取評論 + 萃取
    ├── Step 7: 比較分析
    └── Step 8: 條件性產出報告
        ↓
執行結束：
    ├── 更新 watchlist.json
    ├── 更新 execution_state.json
    ├── 產出每日摘要 docs/daily_summary/{date}.md
    ├── 在對話中顯示精簡版摘要
    └── 更新 README.md 健康度儀表板
```

### 每日增量模式

若今日已執行過完整流程：
- Step 3 僅處理新產品
- Step 5-8 僅處理變動類別
- Step 1-2 正常執行

### 模型指派

- Layer 相關任務（fetch、萃取、合併、update）→ `sonnet`
- Mode 報告產出 → `opus`

### 子代理分派

- 需要寫入檔案 → `general-purpose`（透過 Write 工具）
- 純腳本執行 → `Bash`

## 決策權限

Architect 可自主決定：
- 萃取的平行化程度（根據 JSONL 行數）
- 去重判定（根據 source_url 和 product_id）
- 錯誤處理策略（單一 Layer 失敗不阻斷其他 Layer）
- 將產品加入監控清單（警告報告觸發時）
- 將類別加入研究缺口（[REVIEW_NEEDED] 觸發時）
- 暫緩發佈（連續 3 次補齊失敗時）
- 從監控清單移除產品（問題已解決時）

Architect 需要人工確認：
- 新增 Layer 或 Mode
- 修改 category enum
- 刪除已有資料
- 強制發佈暫緩類別
- 手動加入/移除監控清單（使用者指令時執行，無需確認）

## 健康度巡檢

執行完成後更新 README.md 健康度儀表板：
- 各 Layer 最後更新時間、商品數、評論數
- 各 Mode 最後產出時間
- 標記異常狀態（⚠️ / ❌）

## 每日摘要（強制）

執行完整流程結束時**必須**產出摘要：

1. **檔案輸出**：`docs/daily_summary/{YYYY-MM-DD}.md`
2. **對話顯示**：精簡版摘要（執行統計、監控狀態、待處理項目）
3. **異常標記**：有待處理項目時加上 `⚠️ 需注意`

> 未產出每日摘要視為執行未完成，下次執行時會從中斷點繼續。

## 暫緩發佈管理

當類別連續 3 次補齊失敗：
1. 標記為「暫緩發佈」
2. 報告移至 `docs/Narrator/deferred/`
3. 加入 `watchlist.json` 的 `deferred_categories`
4. 每週一自動重試
5. 在每日摘要中顯示暫緩清單

---

## 狀態追蹤機制

執行流程支援中斷恢復。每個 Step/子任務完成後更新狀態文件。

### 狀態文件

`docs/Extractor/execution_state.json`

```json
{
  "last_updated": "ISO timestamp",
  "last_completed_date": "YYYY-MM-DD",
  "execution_mode": "daily_incremental | full | recovery",
  "current_step": 1-8,
  "daily_stats": { "YYYY-MM-DD": { ... } },
  "steps": { "step_1": { "status": "completed", ... }, ... },
  "watchlist_sync": { ... },
  "research_gaps": { ... }
}
```

### 恢復邏輯

```
「執行完整流程」
    ↓
檢查 execution_state.json
    ├── 不存在 → 從頭開始
    └── 存在 → 讀取狀態，從中斷點繼續
```

### 狀態更新時機

| 事件 | 更新內容 |
|------|---------|
| Step 完成 | `status: completed`, `completed_at` |
| 類別研究完成 | `completed_categories` 新增 |
| JSONL 萃取完成 | `completed_jsonl` 新增 |

### JSON 文件初始化

| 文件 | 初始化時機 |
|------|-----------|
| `execution_state.json` | 首次執行 |
| `watchlist.json` | 首次產出警告報告 |
| `pending_decisions.json` | 首次 `[REVIEW_NEEDED]` |
| `decision_log.json` | 首次記錄決策 |
| `error_log.json` | 首次發生錯誤 |

---

## 每日執行模式

### 執行模式判斷

```
讀取 execution_state.json
    ├── last_completed_date = 今日 → 增量模式
    ├── last_completed_date = 昨日 → 標準每日更新
    └── last_completed_date > 1 天前 → 完整重跑
```

### 跨日執行處理

| 時間點 | 判定規則 |
|--------|---------|
| 執行開始時間 | 作為「執行日期」基準 |
| 跨日後完成 | 使用開始日期 |
| 報告/萃取日期 | 使用執行開始日期 |

### 資料新鮮度

| 資料類型 | 有效期 | 過期處理 |
|---------|--------|---------|
| 排行榜快取 | 24 小時 | 重新抓取 |
| 研究報告 | 30 天 | 標記過期 |
| 評論萃取 | 7 天 | 可重新抓取 |
| 最終報告 | 不過期 | 累積歷史版本 |

### JSONL 清理

| 條件 | 處理 |
|------|------|
| 已成功萃取 | 保留 7 天後刪除 |
| 萃取失敗 | 保留 30 天 |
| 監控產品 | 保留 14 天 |
| 磁碟空間 < 1GB | 緊急清理 > 3 天 |

### 每日 Checklist

| 檢查項目 | 失敗處理 |
|---------|---------|
| Amazon Session | 提示重新登入 |
| Qdrant 連線 | 使用本地退化 |
| 磁碟空間 > 1GB | 清理 raw/ |

---

## 每日執行注意事項

### 潛在問題

| 問題 | 症狀 | 解決方案 |
|------|------|---------|
| Session 過期 | 抓取返回 0 則 | `npx tsx src/amazon/scraper.ts --login` |
| Rate Limit | WebSearch 失敗 | 減少平行數 |
| 監控產品下架 | ASIN 返回 404 | 執行下架處理 |
| 磁碟空間不足 | 寫入失敗 | 清理 raw/ |

### 下架偵測

| 偵測方式 | 判定 |
|---------|------|
| HTTP 404 | 確定下架 |
| 「目前無法購買」 | 連續 3 天則判定下架 |
| 評論頁無評論 | Session 問題，非下架 |

### 下架處理

1. 記錄到 `error_log.json`
2. 更新 `watchlist.json`（status: delisted）
3. 報告加上「產品已下架」標記
4. 在每日摘要中列出

### 長期維護

| 頻率 | 任務 |
|------|------|
| 每週 | 檢查監控清單，移除已解決問題 |
| 每月 | 清理 > 30 天 JSONL |
| 每月 | 審核 `[REVIEW_NEEDED]` 報告 |
| 每季 | 審核問題類別分組 |

### 效能最佳化

| 項目 | 狀態 |
|------|------|
| Discovery JSONL（含產品名稱） | ✅ 已實作 |
| WebFetch 快取（15 分鐘） | ✅ 內建 |
| JSONL 快取（同日跳過） | ✅ 已實作 |
| 增量萃取 | ⏳ 待實作 |

### 錯誤恢復

```
執行中發生錯誤
    ↓
自動儲存到 execution_state.json
    ↓
記錄到 error_log.json
    ↓
下次執行時顯示錯誤摘要
```

### 資料一致性檢查

| 檢查項目 | 失敗處理 |
|---------|---------|
| 每個類別有 research.md | 標記補齊 |
| 每個產品有萃取結果 | 重新抓取 |
| 每個類別有最終報告 | 重新產出 |
