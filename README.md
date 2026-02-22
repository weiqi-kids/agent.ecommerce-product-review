# 電商商品評論智慧分析系統

E-commerce Product Review Intelligence System — 透過 Claude CLI 多角色協作，自動化擷取、分析與報告電商商品評論。

## 架構

```
電商平台 → Playwright 爬蟲 → JSONL → L1-L6 萃取 → Markdown → Qdrant → Mode 報告
```

| 角色 | 職責 |
|------|------|
| **Architect** | 系統編排、指揮協調、監控追蹤 |
| **Extractor** | 資料擷取 + L1-L6 六層萃取 |
| **Narrator** | 跨來源綜合分析、報告產出 |

## 執行流程（Step 1-8）

| Step | 說明 |
|------|------|
| 1 | 監控清單追蹤 |
| 2 | 研究缺口補齊 |
| 3 | 抓取排行榜 |
| 4 | 產品分組（按具體問題） |
| 5 | 問題研究 + 競品發現 |
| 6 | 抓取評論 + L1-L6 萃取 |
| 7 | 比較分析 |
| 8 | 條件性產出報告 |

## 支援平台（Layer）

| Layer | 平台 | 語系 | 登入 | Discovery | 狀態 |
|-------|------|------|------|-----------|------|
| `amazon_us` | Amazon.com | en-US | ✅ 需要 | bestsellers, movers | ✅ 主力 |
| `bestbuy_us` | Best Buy | en-US | ❌ 不需 | best-sellers, top-rated | ✅ 電子類 |
| `walmart_us` | Walmart | en-US | ❌ 不需 | best-sellers, trending | ✅ 日用類 |

## 報告類型（Mode）

| Mode | 說明 |
|------|------|
| `problem_solver` | 問題解決指南 — 問題導向的完整分析報告 |

> 舊 Mode（aspect_scorecard、pros_cons_digest、issue_radar、claim_verification、usecase_fit）已整合至 `problem_solver`。

## 報告輸出

| 報告類型 | 路徑 | 說明 |
|---------|------|------|
| 推薦報告 | `docs/Narrator/recommendations/` | 能解決問題，且比競品好 |
| 比較報告 | `docs/Narrator/comparisons/` | 能解決問題，但有更好選擇 |
| 警告報告 | `docs/Narrator/warnings/` | 無法解決問題 |
| 痛點報告 | `docs/Narrator/pain_points/` | 全部產品都有嚴重問題 |
| 暫緩報告 | `docs/Narrator/deferred/` | 資料不足且補齊失敗 |

## L1-L6 萃取協議

| Level | 名稱 | 說明 |
|-------|------|------|
| L1 | Product Grounding | 商品基本資訊定錨 |
| L2 | Claim Extraction | 行銷聲明提取 |
| L3 | Aspect Extraction | 體驗面向識別 |
| L4 | Aspect Sentiment | 面向情感分析 |
| L5 | Issue Pattern | 問題模式識別 |
| L6 | Evidence Summary | 證據摘要 |

## 快速開始

```bash
# 1. 安裝爬蟲依賴
cd scrapers && npm install && cd ..

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 填入 API keys

# 3. 首次登入 Amazon（需手動完成驗證）
cd scrapers && npx tsx src/amazon/scraper.ts --login && cd ..

# 4. 執行完整流程（所有平台）
# 在 Claude CLI 中執行：
# 執行完整流程

# 或指定平台：
# 執行完整流程 --platforms amazon
# 執行完整流程 --platforms bestbuy,walmart
```

### 各平台 Discovery 測試

```bash
# Amazon（需登入）
cd scrapers && npx tsx src/amazon/discovery.ts --source bestsellers --limit 10

# Best Buy（可能需 --headless false）
cd scrapers && npx tsx src/bestbuy/discovery.ts --source best-sellers --category electronics --limit 10

# Walmart
cd scrapers && npx tsx src/walmart/discovery.ts --source best-sellers --limit 10
```

## 系統健康度

### Layer 狀態

| Layer | 最後更新 | 商品數 | 今日 Discovery | 狀態 |
|-------|----------|--------|---------------|------|
| amazon_us | 2026-02-23 | 160 | 50 ⚠️ | ⚠️ 腳本未產出檔案 |
| bestbuy_us | 2026-02-17 | 0 | 0 ⚠️ | ⚠️ URL 導向問題 |
| walmart_us | 2026-02-23 | 0 | 40 ⚠️ | ⚠️ 腳本未產出檔案 |

### 監控清單

| 類型 | 數量 |
|------|------|
| 監控產品 | 14 |
| 研究缺口類別 | 5 |
| 暫緩發佈類別 | 0 |

### 今日統計 (2026-02-23)

| 指標 | 數值 |
|------|------|
| Discovery 產品 | 90 (Amazon 50 + Walmart 40) 終端輸出 |
| 監控追蹤 | 0 個（無到期項目） |
| 研究缺口補齊 | 3 個嘗試（進步但未達標） |
| 新類別 | 0 |
| 報告產出 | 0 |

> 詳細資訊見 `docs/Extractor/watchlist.json`

## 目錄結構

```
agent.ecommerce-product-review/
├── CLAUDE.md                    # 系統規格（Claude CLI 自動載入）
├── core/                        # 角色定義與 Layer/Mode 設定
│   ├── Architect/               # Architect 角色定義
│   ├── Extractor/Layers/        # 平台定義
│   │   ├── amazon_us/           # Amazon.com
│   │   ├── bestbuy_us/          # Best Buy
│   │   └── walmart_us/          # Walmart
│   └── Narrator/Modes/          # 報告類型定義（problem_solver）
├── lib/                         # Shell 工具函式庫
├── scrapers/                    # Playwright 爬蟲（TypeScript）
│   └── src/
│       ├── amazon/              # Amazon 爬蟲
│       ├── bestbuy/             # Best Buy 爬蟲
│       ├── walmart/             # Walmart 爬蟲
│       └── common/              # 共用工具
└── docs/                        # 萃取結果與報告輸出
    ├── Extractor/
    │   ├── amazon_us/           # Amazon 萃取結果
    │   ├── bestbuy_us/          # Best Buy 萃取結果
    │   ├── walmart_us/          # Walmart 萃取結果
    │   ├── research/            # 問題研究報告
    │   ├── competitors/         # 競品清單
    │   ├── discovery_cache/     # 排行榜快取（多平台）
    │   ├── execution_state.json # 執行狀態
    │   ├── watchlist.json       # 監控清單
    │   ├── pending_decisions.json # 待決策佇列
    │   ├── decision_log.json    # 決策記錄
    │   └── error_log.json       # 錯誤記錄
    ├── Narrator/
    │   ├── recommendations/     # 推薦報告
    │   ├── comparisons/         # 比較報告
    │   ├── warnings/            # 警告報告
    │   ├── pain_points/         # 痛點報告
    │   └── deferred/            # 暫緩報告
    └── daily_summary/           # 每日執行摘要
```

## 環境需求

- Node.js 18+
- Playwright
- jq
- curl
- Qdrant（雲端或本地）
- OpenAI API Key（embedding 用）
