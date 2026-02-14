# Best Buy US Layer

本 Layer 負責從 BestBuy.com 抓取商品評論並執行 L1-L6 萃取。

## 特點

- **不需登入**：Best Buy 評論頁公開可存取
- **支援 SKU 搜尋**：Best Buy 使用 7 位數 SKU 作為產品識別碼
- **支援 UPC 匹配**：可透過 UPC 跨平台搜尋對應產品
- **電子產品專長**：Best Buy 以電子產品為主，評論質量較高

## 資料流

```
product_urls.txt / SKU / UPC / 搜尋
        ↓
    fetch.sh（呼叫 scraper.ts）
        ↓
    docs/Extractor/bestbuy_us/raw/*.jsonl
        ↓
    L1-L6 萃取
        ↓
    docs/Extractor/bestbuy_us/{category}/{product}.md
```

## 檔案格式

### 輸入

**product_urls.txt**（每行一個 URL 或 SKU）：
```
https://www.bestbuy.com/site/sony-wh-1000xm5/6505727.p
https://www.bestbuy.com/site/6505727.p
6505727
```

### 輸出

**JSONL 格式**（與 Amazon 相同，見 `core/Extractor/CLAUDE.md`）

## 執行方式

```bash
# 透過 URL 抓取
npx tsx src/bestbuy/scraper.ts \
  --url "https://www.bestbuy.com/site/6505727.p" \
  --output "docs/Extractor/bestbuy_us/raw" \
  --max-reviews 100

# 透過 SKU 抓取
npx tsx src/bestbuy/scraper.ts \
  --sku "6505727" \
  --output "docs/Extractor/bestbuy_us/raw"

# 透過 UPC 搜尋並抓取
npx tsx src/bestbuy/scraper.ts \
  --upc "012345678901" \
  --output "docs/Extractor/bestbuy_us/raw"

# 透過產品名稱搜尋
npx tsx src/bestbuy/scraper.ts \
  --search "Sony WH-1000XM5" \
  --output "docs/Extractor/bestbuy_us/raw"
```

## L1-L6 萃取協議

遵循 `core/Extractor/CLAUDE.md` 的通用協議，但有以下差異：

### L1 Product Grounding

| 欄位 | Best Buy 來源 |
|------|--------------|
| product_id | SKU（7 位數字） |
| sku | `[data-sku-id]` 或 URL 提取 |
| upc | 商品頁 UPC（如有） |
| title | `.sku-title h1` |
| brand | `[data-track="product-brand"]` |
| price | `.priceView-hero-price span` |

### L2 Claim Extraction

與 Amazon 相同，從商品描述和標題中提取聲明。

### L3-L6

與 Amazon 相同。

## 平台特有的 [REVIEW_NEEDED] 觸發條件

除通用規則外，以下情況也會觸發：

1. 搜尋結果非完全匹配（UPC 搜尋到不同產品）
2. 評論數 < 10
3. 僅有員工評論（Best Buy 員工可留評）
4. 評論日期過度集中（可能為促銷活動）

## 與 Amazon 評論的整合

Best Buy 評論可作為 Amazon 評論的補充來源：

1. 使用 UPC 或產品型號匹配同一產品
2. 在 L1-L6 萃取時標註來源為 `bestbuy_us`
3. 在跨平台報告中分別呈現各來源的統計

## Best Buy 評論特點

| 特點 | 說明 |
|------|------|
| 驗證購買 | 有 "Verified Purchaser" 標籤 |
| 員工評論 | 有時會有 Best Buy 員工評論 |
| 評分分佈 | 提供詳細的星級分佈直方圖 |
| 有幫助投票 | 支援 helpful/unhelpful 投票 |

## 資料欄位對應

| 欄位 | Amazon | Best Buy |
|------|--------|----------|
| product_id | ASIN | SKU |
| verified | verified_purchase | verified_purchase |
| helpful | helpful_votes | helpful_votes |
| date | YYYY-MM-DD | YYYY-MM-DD |

## URL 格式

Best Buy 產品頁 URL 格式：
- `https://www.bestbuy.com/site/{product-name}/{sku}.p`
- `https://www.bestbuy.com/site/{sku}.p`

評論頁 URL 格式：
- `https://www.bestbuy.com/site/reviews/{sku}?page={n}&sort=MOST_RECENT`
