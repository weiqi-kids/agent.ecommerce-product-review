---
asin: B010OVZO64
store_id: amzn-direct
platform: amazon_us
scraped_at: 2026-03-22
---

# L1: Product Grounding

| 欄位 | 值 |
|------|---|
| **ASIN** | B010OVZO64 |
| **Title** | Pampers Swaddlers Diapers, Size 5 (20-37 lbs), 132 Count, Absorbent, Keeps Baby Dry and Comfortable, Skin Safe Disposable Baby Diaper (Packaging May Vary) |
| **Brand** | Pampers |
| **Price** | $59.77 USD |
| **Platform** | amazon_us |
| **Store** | Amazon.com (amzn-direct) |
| **Average Rating** | 4.85 / 5.0 |
| **Total Reviews (platform)** | 129,930 |
| **Reviews Analyzed** | 13 |
| **Scrape Date** | 2026-03-22 |

**Product Description Summary**: Pampers Swaddlers Size 5（20-37 磅）拋棄式尿布，以 KeepDry Liner 鎖水技術和柔軟材質為核心賣點，具 All-Around LeakGuard、Blowout Barrier，100% 防漏，低致敏（無對羥基苯甲酸酯、元素氯、乳膠），通過 Skin Health Alliance 皮膚科認證，附濕度指示條。

**Key Claims**:
- KeepDry Liner 瞬間鎖水離肌膚
- All-Around LeakGuard + Blowout Barrier，100% 防漏
- 低致敏：無 parabens、elemental chlorine、latex
- Skin Health Alliance 皮膚科認證
- Pampers #1 品牌（睡眠使用，Nielsen 數據）
- 比 Luxury Diaper 更乾爽（品牌自我申報）

---

# L2: Claim Extraction

| Claim | Source | Verification Status |
|-------|--------|-------------------|
| 100% 防漏，All-Around LeakGuard | Bullet points | ✅ 評論普遍確認「no leaks even overnight」、「zero leaks even after long sleep hours」 |
| KeepDry Liner 瞬間鎖水 | Bullet points | ✅ 評論確認高吸收力，嬰兒長時間保持乾爽 |
| 低致敏，皮膚科認證 | Bullet points | ✅ 評論確認「no rashes」、「soft and doesn't irritate the skin」 |
| 柔軟材質 | Bullet points | ✅ 評論一致稱讚柔軟度：「irresistibly soft」、「super soft」 |
| #1 品牌（睡眠使用）| Bullet points | ⚠️ 自我申報（Nielsen），評論支持夜間使用體驗 |
| 比 Luxury Diaper 更乾爽 | Description | ⚠️ 自我申報，評論未直接比較 |

---

# L3: Aspect Extraction

| Aspect | Mentions | Representative Quotes |
|--------|----------|----------------------|
| **softness** | 9 | "incredibly soft and gentle"; "soft, comfortable, and gentle on our baby's skin"; "irresistibly soft"; "very soft and gentle on my baby's sensitive skin"; "super soft" |
| **leak_protection** | 8 | "no leaks even overnight"; "we haven't had leaks even after long sleep hours"; "zero leaks in long sleep"; "haven't had a single blowout or overnight leak" |
| **absorbency** | 7 | "highly absorbent, keeping toddler dry both day and overnight"; "absorbs very well and keeps baby dry for a long time"; "great absorption" |
| **skin_safety** | 6 | "no issues with rashes or irritation"; "doesn't irritate the skin, especially overnight"; "soft and doesn't cause rashes"; "suitable for sensitive skin" |
| **fit** | 5 | "fit is secure without being too tight"; "snug fit"; "comfortable fit that doesn't cause marks" |
| **value** | 4 | "great value for money"; "excellent value"; "132 count provides excellent value" |
| **nighttime_performance** | 4 | "sleep through the night dry"; "comfortable sleep all night"; "dry all night without leaks" |
| **version_inconsistency** | 1 | "disappointed today when I ordered and got the old, much worse style" |
| **size_suitability** | 1 | "Size 4 works great for our baby at 8 months, 9kg" |

---

# L4: Aspect Sentiment

| Aspect | Score (0.0-1.0) | Positive Evidence | Negative Evidence |
|--------|----------------|-------------------|-------------------|
| **softness** | 0.98 | "irresistibly soft"; "super soft and gentle"; "pillowy softness" | 無 |
| **leak_protection** | 0.96 | "zero leaks even after long sleep"; "haven't had a single blowout" | 無 |
| **absorbency** | 0.95 | "highly absorbent"; "keeps toddler dry both day and overnight" | 無 |
| **skin_safety** | 0.96 | "no rashes or irritation"; "doesn't irritate skin even overnight" | 無 |
| **fit** | 0.94 | "secure without being too tight"; "snug fit without marks" | 無 |
| **value** | 0.88 | "great value for money"; "excellent value for 132 count" | 無明確負評（$59.77 高價未被負面評論） |
| **nighttime_performance** | 0.96 | "sleep through the night dry"; "comfortable sleep all night" | 無 |
| **quality_consistency** | 0.70 | 大多數正面 | "got the old, much worse style" (1 則) |
| **overall** | 0.96 | 12/13 為 5★, 1/13 為 4★；平台均評 4.85★ | 無 1★ 負評 |

---

# L5: Issue Patterns

| Issue | Frequency | Severity | Category | Representative Quote |
|-------|-----------|----------|----------|---------------------|
| **version_inconsistency** | 1/13 (8%) | 中 | 產品設計 | "disappointed today when I ordered these and got the old, much worse style (much thinner diapers)" |

**問題分類**:
- ❌ 無法解決問題（功能失效）: 0/13 (0%)
- ⚠️ 產生新問題（副作用）: 0/13 (0%)
- 📦 與產品無關（物流）: 0/13 (0%)

**注意**: 評論中含西班牙語 4 則（正評為主），評分模式 [5.05/4.05] 顯示抓取格式異常但文本清晰。版本不一致問題（新舊版混出）也出現於同品牌 B00TJ6WLV2，疑為 Pampers 產品線共同問題。

---

# L6: Evidence Summary

## 核心結論

Pampers Swaddlers 在本批次評論中表現最為一致且優異，柔軟度、防漏性、夜間使用效果為三大核心優勢，幾乎所有評論均高度正面。此為 Pampers 旗艦產品線（Swaddlers 定位高於 Baby Dry），$59.77/132 片的定價在評論中未引發明顯抗拒。

## 優勢

1. **柔軟度**: 最高頻提及，「pillowy softness」為品牌核心訴求，評論一致確認
2. **防漏與夜間使用**: 多位家長確認夜間長達數小時不漏尿，Blowout Barrier 設計有效
3. **皮膚安全性**: 低致敏設計在評論中被多位家長驗證，敏感肌嬰兒使用後無皮疹
4. **綜合品質**: 多位家長表示嘗試其他品牌後回歸 Pampers Swaddlers 作為主力選擇

## 侷限說明

- 本批次 13 則評論 12 則為 5★，偏差極高
- 版本不一致問題（1 則）：新版改良後部分訂單仍出貨舊版，品質有差距
- 含多語言評論（西班牙語 4 則），部分可能為拉美地區版本
- 樣本極小（13/129,930），不代表完整用戶意見分佈
- 基於評論的分析，非客觀產品測試

## 競品對比提及

- 與 Huggies 比較：多則評論嘗試後選擇 Pampers，「Huggies ran big… Pampers fits newborns especially the little 6 pound ones」
- 與 Pampers Baby Dry 比較：Swaddlers 定位更高，「not as generic, thin, boxy」；但 Baby Dry 也有更新版本追上
- 與多個品牌比較：「tried multiple diaper brands, Pampers Swaddlers have been most consistent」

## Confidence Level

**中-高** — 13 則評論幾乎全為強烈正評（12/13 五星），方向極為一致，且部分評論有具體使用情境描述（夜間、敏感肌），可信度較高，但樣本偏差風險仍高。
