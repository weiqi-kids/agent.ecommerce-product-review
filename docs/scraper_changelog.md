# 爬蟲演化記錄

本文件記錄爬蟲系統的演化過程，包含新增平台、功能擴充、架構變更等。

---

## 版本總覽

| 版本 | 日期 | 重大變更 |
|------|------|----------|
| v0.1 | 2026-02-02 | Amazon 基礎爬蟲 |
| v0.2 | 2026-02-03 | Amazon 登入支援 |
| v0.3 | 2026-02-04 | 批次抓取、產品發現 |
| v0.4 | 2026-02-08 | 發現功能擴充 |
| v1.0 | 2026-02-14 | 多來源架構（Walmart、Best Buy） |
| v1.1 | 2026-02-14 | 商品圖片抓取 |

---

## v1.1 — 商品圖片抓取（2026-02-14）

### 變更
讓報告顯示商品圖片，直接連結到原始平台的圖片 URL。

### 修改檔案

**types.ts**
- 新增 `image_url?: string` 欄位

**各平台 selectors.ts**
- Amazon：`#landingImage, #imgBlkFront, #main-image`
- Walmart：`[data-testid="hero-image"] img`
- Best Buy：`.primary-image img`

**各平台 parser.ts**
- 新增 `parseImageUrl()` 或直接抓取 `<img src>`

**萃取協議 CLAUDE.md**
- L1 區塊新增圖片顯示：`![{product_title}]({image_url})`

---

## v1.0 — 多來源架構（2026-02-14）

### 背景
Amazon 評論頁需要登入才能完整抓取，Session 經常過期。為了不依賴登入，改採多來源聚合策略。

### 新增平台

#### Walmart US
```
scrapers/src/walmart/
├── scraper.ts   — 主爬蟲（支援 URL/UPC/搜尋）
├── parser.ts    — 頁面解析
└── selectors.ts — CSS 選擇器

core/Extractor/Layers/walmart_us/
├── CLAUDE.md
├── fetch.sh
└── product_urls.txt
```

**特點**：
- 不需登入
- 支援 UPC 跨平台搜尋
- 評論頁 URL：`/reviews/product/{id}?page={n}`

#### Best Buy US
```
scrapers/src/bestbuy/
├── scraper.ts   — 主爬蟲（支援 URL/SKU/UPC/搜尋）
├── parser.ts    — 頁面解析
└── selectors.ts — CSS 選擇器

core/Extractor/Layers/bestbuy_us/
├── CLAUDE.md
├── fetch.sh
└── product_urls.txt
```

**特點**：
- 不需登入
- 使用 7 位數 SKU 作為產品 ID
- 評論頁 URL：`/site/reviews/{sku}?page={n}`

### 新增共用模組

#### ReviewSourceManager
`scrapers/src/common/review-source-manager.ts`

多來源評論聚合管理器：
- `aggregateByAsin()` — 從 Amazon ASIN 出發，搜尋其他平台
- `aggregateByUpc()` — 透過 UPC 跨平台聚合
- `aggregateByName()` — 透過產品名稱搜尋聚合

#### ProductMatcher
`scrapers/src/common/product-matcher.ts`

跨平台產品匹配：
- UPC 匹配（高信心度）
- 品牌+型號匹配（中信心度）
- 名稱搜尋匹配（低信心度）

### 型別更新
`scrapers/src/common/types.ts` 新增欄位：
- `sku` — Best Buy SKU
- `walmart_id` — Walmart Product ID

### 萃取協議更新
`core/Extractor/CLAUDE.md` 變更：
- L1：新增 `sources` 陣列記錄各來源統計
- L3-L5：新增 `by_source` 欄位
- `[REVIEW_NEEDED]` 規則：所有來源加總 < 20 則觸發

---

## v0.4 — 發現功能擴充（2026-02-08）

### 變更
`scrapers/src/amazon/discovery.ts` 擴充：
- 新增更多品類支援
- 改善分頁處理

---

## v0.3 — 批次抓取、產品發現（2026-02-04）

### 新增檔案

#### batch-scrape.ts
批次抓取多個 ASIN：
- 從檔案讀取 ASIN 清單
- 斷點續傳支援
- 進度追蹤

#### discovery.ts
Amazon 熱門商品發現：
- `bestsellers` — 銷量排行榜
- `movers` — 24hr 上升最快
- `wishlist` — 願望清單最多
- `newreleases` — 熱門新品

---

## v0.2 — Amazon 登入支援（2026-02-03）

### 新增檔案

#### auth.ts
Session 管理模組：
- `isLoggedIn()` — 檢查登入狀態
- `isSessionExpired()` — 偵測 Session 過期
- `interactiveLogin()` — 互動式手動登入

### 變更
- `scraper.ts` 整合登入檢查
- `browser.ts` 新增 `launchPersistentContext()` 保存登入狀態

---

## v0.1 — Amazon 基礎爬蟲（2026-02-02）

### 初始架構
```
scrapers/
├── package.json
├── tsconfig.json
└── src/
    ├── amazon/
    │   ├── scraper.ts    — 主爬蟲
    │   ├── parser.ts     — 頁面解析
    │   └── selectors.ts  — CSS 選擇器
    └── common/
        ├── browser.ts    — Playwright + Stealth Plugin
        ├── output.ts     — JSONL 分批輸出
        └── types.ts      — 共用型別
```

### 功能
- 單一商品評論抓取
- 分頁處理
- JSONL 分批輸出（每批 50 則）
- 反偵測：隨機延遲、User-Agent、Stealth Plugin

---

## 未來規劃

| 優先級 | 項目 | 說明 |
|--------|------|------|
| 高 | Reddit 評論 | 從討論串抓取用戶意見 |
| 中 | Target.com | 另一個大型零售商 |
| 低 | Amazon JP | 日本市場 |
