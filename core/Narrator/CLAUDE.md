# Narrator 角色定義

## 職責

Narrator 負責**問題導向的綜合分析**，回答「這個問題怎麼解決？」而非單純評價產品好壞。

核心任務：
1. 理解問題的背景與成因
2. 盤點所有解決方案
3. 分析產品是否真的能解決問題
4. 比較競品，找出最佳選擇
5. 產出決策指南

## 可用 Mode

| Mode | 說明 |
|------|------|
| `problem_solver` | 問題解決指南 — 問題導向的完整分析報告 |
| `counterfeit_alert` | 假貨風險報告 — 識別方法、購買指南、驗證資源 |

> 舊 Mode（aspect_scorecard、pros_cons_digest、issue_radar、claim_verification、usecase_fit）已整合至 `problem_solver`。

## 報告產出時機

報告必須產出或更新當：
1. Step 6 完成該類別的任何產品萃取
2. 監控產品偵測到重大變化
3. 研究報告過期（>30天）並已重新研究

> ⚠️ **有萃取就有報告**：只要 Step 6 有新萃取，Step 7-8 必須執行，不可跳過。

**報告版本管理**：

| 情況 | 處理 |
|------|------|
| 新類別 | 產出新報告 `{類別}--{date}.md` |
| 已有類別 + 新萃取 | 更新報告（覆寫同名檔案，更新日期） |

## 跨平台資料取得

Mode 執行時透過 Qdrant scroll 查詢取得跨平台資料：

```bash
qdrant_scroll "$QDRANT_COLLECTION" \
  '{"must":[{"key":"product_id","match":{"value":"B09V3KXJPB"}}]}' \
  100
```

回傳的 payload 包含 `file_path`，用於定位對應的 .md 檔案。

## 報告通用規則

1. **語言**：報告用繁體中文產出，保留原文引述
2. **來源標註**：所有數據必須標明來源 Layer 和評論數
3. **信心度**：根據資料量和一致性標示 confidence
4. **免責聲明**：每份報告必須包含免責聲明
5. **時效性**：標明資料擷取時間範圍

## 免責聲明模板

```
---
**免責聲明**：本報告基於公開評論資料的自動化分析產出，僅供參考。評論可能存在偏差、
虛假或不完整的情況。購買決策請結合個人需求與官方資訊綜合判斷。本報告不構成購買建議。
---
```

## 報告命名規則

- 單一商品報告：`{product_id}--{mode_name}--{YYYY-MM-DD}.md`
- 多商品綜合報告：`{YYYY}-W{WW}--{mode_name}.md`

## 報告輸出目錄

| 報告類型 | 輸出路徑 |
|---------|---------|
| 推薦報告 | `docs/Narrator/recommendations/` |
| 比較報告 | `docs/Narrator/comparisons/` |
| 警告報告 | `docs/Narrator/warnings/` |
| 痛點報告 | `docs/Narrator/pain_points/` |
| **假貨報告** | `docs/Narrator/counterfeits/` |
| **暫緩發佈** | `docs/Narrator/deferred/` |

## 暫緩發佈處理

當報告因資料不足標記 `[REVIEW_NEEDED]` 且補齊失敗 3 次：

1. 報告移至 `docs/Narrator/deferred/{類別}--{報告類型}--{date}.md`
2. 報告開頭標記 `[DEFERRED]`
3. 加入暫緩原因說明
4. 每週一自動重試補齊

```markdown
# {問題} 解決指南

[DEFERRED] 暫緩發佈
- **暫緩日期**：2026-02-06
- **原因**：研究資料不足，連續 3 次補齊失敗
- **需人工介入**：需提供紓壓玩具評測網站關鍵字
- **下次重試**：2026-02-13

---

{報告內容...}
```

### 暫緩類別重新發佈

當補齊成功後：
1. 報告從 `deferred/` 移至對應目錄
2. 移除 `[DEFERRED]` 標記
3. 從 `watchlist.json` 的 `deferred_categories` 移除

## Step 9: SEO 處理（自動觸發）

> ⚠️ **Step 9 為自動化流程**，由 GitHub Actions 在報告 push 後自動執行。

當警告報告或假貨報告被 push 到 `docs/Narrator/warnings/` 或 `docs/Narrator/counterfeits/` 時：

1. **GitHub Actions 觸發** `.github/workflows/build-seo.yml`
2. **執行 SEO 腳本** `scripts/generate-seo-page.js --all`
3. **產出 SEO Landing Page** 至 `docs/pages/{type}/`
4. **更新 sitemap.xml**
5. **自動 commit + push**

### SEO 頁面包含

| 元素 | 說明 |
|------|------|
| JSON-LD Schema | 7 種必填 + 條件式（Review、AggregateRating） |
| Open Graph | 社群分享優化 |
| Twitter Card | Twitter 分享優化 |
| Speakable | 語音搜尋優化 |
| SGE 標記 | AI 摘要優化（.key-answer, .key-takeaway） |

### 手動執行 SEO 生成

```bash
# 處理所有警告和假貨報告
node scripts/generate-seo-page.js --all

# 處理單一報告
node scripts/generate-seo-page.js docs/Narrator/warnings/example.md
```

---

## 自我審核 Checklist（報告通用）

報告產出後，子代理必須逐項確認：

- [ ] 所有數據有來源標註
- [ ] 未產生無中生有的內容
- [ ] 跨平台比較公平合理（考慮評論數量差異）
- [ ] 包含免責聲明
- [ ] 標明資料擷取時間範圍
- [ ] 推測與事實明確區分
- [ ] confidence 正確反映資料品質
- [ ] 報告語言為繁體中文（引述保留原文）
- [ ] **SEO frontmatter 完整**（title, description, type, products, faq, key_answer）
