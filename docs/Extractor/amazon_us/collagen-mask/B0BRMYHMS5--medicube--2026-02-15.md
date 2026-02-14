# medicube Wrapping Mask Collagen Overnight Peel Off Facial Mask

[REVIEW_NEEDED]

**原因**：爬蟲取回 0 則評論（規則：評論數 < 10 則）

## L1: Product Grounding

| Field | Value |
|---|---|
| **product_id** | B0BRMYHMS5 |
| **UPC/EAN** | - |
| **ASIN** | B0BRMYHMS5 |
| **Brand** | medicube |
| **Platform** | amazon_us |
| **Store** | Amazon.com (amzn-direct) |
| **Category** | beauty |
| **Language** | en |
| **Price** | - (無資料) |
| **Avg Rating** | - (無資料) |
| **Source URL** | https://www.amazon.com/dp/B0BRMYHMS5 |
| **Fetched At** | 2026-02-13T13:04:21Z |
| **Reviews Analyzed** | 0 |

**商品標題**：medicube Wrapping Mask Collagen Overnight Peel Off Facial Mask | Elasticity & Hydration Care, Reduces Sagging & Dullness | Hydrolyzed Collagen For Glowing Skin | Korean Skin Care, 2.53 fl.oz

## L2: Claim Extraction

無法執行（缺少商品描述資料）

## L3: Aspect Extraction

無評論資料，無法執行

## L4: Aspect Sentiment

無評論資料，無法執行

## L5: Issue Patterns

無評論資料，無法執行

## L6: Evidence-Based Summary

### 資料擷取失敗分析

**失敗原因可能包括**：
1. Session 過期需重新登入
2. 產品頁面未完全載入
3. 產品為新上架商品，尚無評論
4. 產品已下架或不可購買
5. 反爬蟲機制阻擋

### 建議處理方式

1. **重新登入**：執行 `npx tsx src/amazon/scraper.ts --login`
2. **驗證產品可用性**：手動訪問產品頁面確認狀態
3. **調整爬蟲策略**：增加頁面載入等待時間、捲動觸發評論區
4. **檢查產品評論數**：若產品本身無評論，應從追蹤清單移除

### 自我審核 Checklist

- [x] ASIN 格式正確（10 碼英數字）
- [x] category 使用共用 enum 值（beauty）
- [ ] price 包含 amount 和 currency (USD) — **無資料**
- [ ] 評論的 language 標註正確 — **無評論**
- [ ] verified_purchase 正確反映 — **無評論**
- [x] batch 分批正確（batch_index=1, batch_total=1）
- [x] L1-L2 僅在 batch_index=1 時執行
- [ ] aspect 名稱使用英文 — **無評論**
- [x] 未自行擴大 REVIEW_NEEDED 範圍（符合「評論數 < 10」規則）

---
*Generated: 2026-02-15 | Source: amazon_us | Reviews: 0 | Confidence: N/A (無評論資料)*
