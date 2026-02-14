# Walmart US Layer

本 Layer 負責從 Walmart.com 抓取商品評論並執行 L1-L6 萃取。

## 特點

- **不需登入**：Walmart 評論頁公開可存取
- **支援 UPC 匹配**：可透過 UPC 跨平台搜尋對應產品
- **支援搜尋**：可透過產品名稱搜尋

## 資料流

```
product_urls.txt / UPC / 搜尋
        ↓
    fetch.sh（呼叫 scraper.ts）
        ↓
    docs/Extractor/walmart_us/raw/*.jsonl
        ↓
    L1-L6 萃取
        ↓
    docs/Extractor/walmart_us/{category}/{product}.md
```

## 檔案格式

### 輸入

**product_urls.txt**（每行一個 URL）：
```
https://www.walmart.com/ip/Sony-WH-1000XM5/123456789
https://www.walmart.com/ip/456789012
```

### 輸出

**JSONL 格式**（與 Amazon 相同，見 `core/Extractor/CLAUDE.md`）

## 執行方式

```bash
# 透過 URL 抓取
npx tsx src/walmart/scraper.ts \
  --url "https://www.walmart.com/ip/123456789" \
  --output "docs/Extractor/walmart_us/raw" \
  --max-reviews 100

# 透過 UPC 搜尋並抓取
npx tsx src/walmart/scraper.ts \
  --upc "012345678901" \
  --output "docs/Extractor/walmart_us/raw"

# 透過產品名稱搜尋
npx tsx src/walmart/scraper.ts \
  --search "Sony WH-1000XM5" \
  --output "docs/Extractor/walmart_us/raw"
```

## L1-L6 萃取協議

遵循 `core/Extractor/CLAUDE.md` 的通用協議，但有以下差異：

### L1 Product Grounding

| 欄位 | Walmart 來源 |
|------|-------------|
| product_id | Walmart Product ID（數字） |
| upc | 商品頁 UPC（如有） |
| title | `h1[itemprop="name"]` |
| brand | `[data-testid="brand-name"]` |
| price | `[itemprop="price"]` |

### L2 Claim Extraction

與 Amazon 相同，從商品描述和標題中提取聲明。

### L3-L6

與 Amazon 相同。

## 平台特有的 [REVIEW_NEEDED] 觸發條件

除通用規則外，以下情況也會觸發：

1. 搜尋結果非完全匹配（UPC 搜尋到不同產品）
2. 評論數 < 10（Walmart 評論通常較少）
3. 評論日期集中在單一時段（可能為促銷活動）

## 與 Amazon 評論的整合

Walmart 評論可作為 Amazon 評論的補充來源：

1. 使用 UPC 匹配同一產品
2. 在 L1-L6 萃取時標註來源為 `walmart_us`
3. 在跨平台報告中分別呈現各來源的統計

## 資料欄位對應

| 欄位 | Amazon | Walmart |
|------|--------|---------|
| product_id | ASIN | Product ID |
| verified | verified_purchase | verified_purchase |
| helpful | helpful_votes | helpful_votes |
| date | YYYY-MM-DD | YYYY-MM-DD |
