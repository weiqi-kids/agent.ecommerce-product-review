# L1-L6 萃取結果

## L1: 商品定錨

| 欄位 | 值 |
|------|---|
| product_id | B00BB5DJU6 |
| store_id | amazon_us |
| brand | Georgia-Pacific |
| title | Georgia-Pacific Spectrum Standard 92 Multipurpose Paper, 8.5 x 11 Inches, 1 box of 3 packs (1500 Sheets) (998606) |
| price | USD 259.00（疑似異常高價，可能為商業採購整箱定價） |
| rating | N/A |
| rating_count | N/A |
| review_count | 6 |
| category | other |
| extraction_date | 2026-03-25 |

## L2: 聲明提取

來源：bullet_points / description

| # | 聲明 | 類型 |
|---|------|------|
| 1 | Buyers Laboratory Certified (BLI) | 認證聲明 |
| 2 | Sustainable Forestry Initiative Certified Chain of Custody | 環保聲明 |
| 3 | 92 Bright White, 20 lb, 8.5 x 11 Letter Size | 規格聲明 |
| 4 | Made in the USA | 產地聲明 |
| 5 | Designed for copying and printing in a wide variety of imaging devices | 用途聲明 |
| 6 | Produces low dust to protect copier/printer | 功能聲明 |

## L3: 面向提取

| aspect | mentions | 代表引述 |
|--------|---------|---------|
| print_quality | 5 | "works terrifically with laserjet printers"; "ink prints well on this paper" |
| jam_resistance | 4 | "never get paper jams on my printers"; "ink dries almost instantly" |
| low_dust | 3 | "will not produce a lot of messy dust in the copier/printer as other brands" |
| paper_quality | 3 | "very high-quality, bright white (92), 20-lb paper" |
| pressure_lines | 1 | "most of the first 50 or so pages have pressure lines through them, creating folds" |
| value_for_money | 3 | "Good value, ink prints well" |

## L4: 面向情感分析

| aspect | score | sentiment | evidence |
|--------|-------|-----------|---------|
| print_quality | 0.92 | 極正面 | 多位用戶在不同機型（Kodak、HP、雷射）均獲良好結果 |
| jam_resistance | 0.92 | 極正面 | "never get paper jams"; 推薦自影印加盟業者的背書 |
| low_dust | 0.95 | 極正面 | "不會產生大量粉塵"是業者推薦的主要理由 |
| paper_quality | 0.90 | 極正面 | 92 亮度和 20 lb 重量表現符合預期 |
| pressure_lines | 0.15 | 極負面 | 前 50 張出現壓痕線折痕（1 則 4 星評論） |
| value_for_money | 0.82 | 正面 | 性價比合理 |

## L5: 問題模式識別

| 問題 | frequency | severity | 分類 |
|------|---------|---------|------|
| 前批次紙張壓痕線 | 17% | medium | ⚠️ 產生新問題（品管問題） |
| 價格異常高（$259） | — | high | ⚠️ 資料品質問題（可能為商業採購整箱） |

## L6: 證據摘要

### Strengths
- **Low dust production**：影印機加盟業者特別推薦，長期使用不傷機器
- **Consistent jam-free**：多位用戶在不同機型均確認無卡紙
- **Professional quality**：適合各種辦公室影印和列印需求

### Weaknesses
- 前批次紙張有壓痕線（品管問題，1 位用戶反映）
- 價格顯示 $259 可能有資料問題（或為整箱商業採購定價）

### Claim vs Reality
| 聲明 | 現實 | 驗證狀態 |
|------|------|---------|
| Low dust | 業者親身推薦，長期驗證 | ✅ 驗證 |
| Made in USA | 用戶認可 | ✅ 驗證 |
| Wide variety of imaging devices | 多機型均有正面回報 | ✅ 驗證 |

**整體評估**：業者推薦的低塵配方是差異化優點。評論數量偏少，且有一個品管問題需注意。

---
[REVIEW_NEEDED] 原因：評論數僅 6 則，低於建議的 10 則門檻；價格資料異常（$259 可能不反映實際零售價）。
