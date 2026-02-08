# amazon_us Layer 定義

## Layer 定義表

| 項目 | 值 |
|------|------|
| **Layer name** | amazon_us（Amazon 美國站） |
| **Platform** | Amazon.com |
| **Region/Locale** | en-US |
| **Scraper** | scrapers/src/amazon/scraper.ts |
| **Data type** | 商品評論 |
| **Automation level** | 80% — 爬蟲自動化、萃取自動化，商品 URL 需人工維護 |
| **Category enum** | 共用品類（見 core/Extractor/CLAUDE.md） |
| **Reviewer persona** | 資料可信度審核員、消費者保護審核員 |

## 平台特性

- Amazon US 商品以 ASIN（10 碼英數字）為主鍵
- 評論包含 verified_purchase 標記
- 評分為 1-5 星制
- 評論語言以英文為主，偶有其他語言
- 賣家可能是 Amazon 官方（amzn-direct）或第三方

## 萃取注意事項

- **ASIN 提取**：從 URL 或頁面資料提取，格式為 `/dp/{ASIN}` 或 `/product-reviews/{ASIN}`
- **品類判定**：優先使用 category_breadcrumb，若不明確則根據商品標題判定
- **評論語言**：預設為 `en`，若偵測到非英文評論需在 L1 language 欄位標註
- **價格**：抓取當下售價，注意可能有折扣價和原價之分
- **賣家識別**：區分 Amazon 直售和第三方賣家

## `[REVIEW_NEEDED]` 觸發規則

以下情況**必須**標記 `[REVIEW_NEEDED]`：
1. 爬蟲取回少於 10 則評論（資料不足）
2. 商品標題與 product_registry.md 不符 >30%（可能抓錯商品頁）
3. 偵測到語言不符（US listing 出現大量非英文評論 >20%）
4. 聲明驗證發現直接矛盾（L2 vs L4 衝突）
5. 評論日期集中在極短期間（>50% 評論在 7 天內，疑似灌水）
6. verified_purchase 比例異常低（<30%，疑似刷評）

以下情況**不觸發** `[REVIEW_NEEDED]`：
- ❌ 僅有 Amazon US 單一平台資料（結構性限制）
- ❌ 評論數量少但 ≥10 則（用 confidence 反映）
- ❌ 缺少 UPC/EAN（Amazon 不一定提供）
- ❌ 某些 aspect 的 mentions 數量少

## 自我審核 Checklist

萃取完成後必須逐項確認：

- [ ] ASIN 格式正確（10 碼英數字）
- [ ] category 使用共用 enum 值
- [ ] price 包含 amount 和 currency (USD)
- [ ] 評論的 language 標註正確
- [ ] verified_purchase 正確反映
- [ ] batch 分批正確（每批 ≤50 則）
- [ ] L1-L2 僅在 batch_index=1 時執行
- [ ] aspect 名稱使用英文
- [ ] 未自行擴大 REVIEW_NEEDED 範圍

---

## Scraper 技術備忘

### 反偵測設定

爬蟲使用 `playwright-extra` + `puppeteer-extra-plugin-stealth`：

```typescript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(StealthPlugin());
```

**不要自行實作反偵測**（如覆寫 `navigator.webdriver`），stealth plugin 已處理。

### Amazon 平台限制（2026-02 確認）

| 頁面 | 未登入 | 已登入 | 備註 |
|------|--------|--------|------|
| 商品頁 `/dp/{ASIN}` | ✅ 可抓取 | ✅ 可抓取 | 含 8-15 則評論 |
| 評論專頁 `/product-reviews/{ASIN}` | ❌ 導向登入 | ✅ 可抓取 | 需點擊分頁 |

### Amazon 登入流程

爬蟲支援兩種模式：

| 模式 | 評論數 | 適用場景 |
|------|--------|----------|
| 未登入（`--no-auth`） | 8-15 則 | 快速測試、少量需求 |
| 已登入（預設） | 無上限 | 完整資料擷取 |

**首次使用需手動登入一次**：

```bash
cd scrapers

# 1. 開啟瀏覽器進行手動登入（只需一次）
npx tsx src/amazon/scraper.ts --login

# 2. 在瀏覽器中完成 Amazon 登入（包含 CAPTCHA 驗證）
# 3. 登入成功後程式會自動偵測並關閉瀏覽器
# 4. Session 保存在 .browser-profiles/amazon/
```

**後續使用自動載入登入狀態**：

```bash
# 已登入模式（預設）- 可抓取完整評論
npx tsx src/amazon/scraper.ts \
  --url "https://www.amazon.com/dp/B0BSHF7WHW" \
  --output ./output \
  --max-reviews 100

# 未登入模式 - 僅商品頁評論
npx tsx src/amazon/scraper.ts \
  --url "https://www.amazon.com/dp/B0BSHF7WHW" \
  --no-auth
```

**Session 管理**：
- Session 保存位置：`scrapers/.browser-profiles/amazon/`
- 有效期：約數週（視 Amazon 政策）
- Session 過期時會提示重新執行 `--login`

### 評論頁分頁注意事項

Amazon 對 `goto(url?pageNumber=N)` 有反爬蟲機制，**必須使用點擊分頁按鈕**：

```typescript
// ❌ 錯誤：直接導航到分頁 URL（會被偵測，返回重複內容）
await page.goto(`/product-reviews/${asin}?pageNumber=2`);

// ✅ 正確：點擊「下一頁」按鈕
const nextButton = await page.$('li.a-last a');
await nextButton.click();
await randomDelay(2000, 4000);
```

### 頁面載入策略

| 策略 | 使用時機 |
|------|----------|
| `domcontentloaded` | 預設使用，較快 |
| `load` | 需要圖片等資源時 |
| `networkidle` | **避免使用**，常導致 timeout |

```typescript
// 推薦模式
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('load').catch(() => {}); // 可選，不阻塞
```

### 常見問題排查

| 症狀 | 可能原因 | 解法 |
|------|----------|------|
| `Unknown Product` | 頁面未完全載入 | 改用 `domcontentloaded` + 捲動 |
| `0 reviews` | 評論區需捲動觸發 | 捲動 5-10 次後再擷取 |
| `Timeout exceeded` | `networkidle` 過慢 | 改用 `domcontentloaded` |
| `ENOENT` 寫檔失敗 | 輸出目錄不存在 | `output.ts` 已修復（自動建立） |
| 評論頁導向登入 | 未登入或 Session 過期 | 執行 `--login` 重新登入 |
| 每頁都是重複評論 | 使用 URL 分頁被偵測 | 改用點擊分頁按鈕（已修復） |
| `Session 過期` 提示 | Amazon 登入失效 | 執行 `--login` 重新登入 |

### 錯誤經驗記錄（避免重蹈覆轍）

#### 1. 頁面載入策略選擇錯誤

**錯誤**：使用 `waitUntil: 'networkidle'` 等待頁面載入。

**後果**：Amazon 等大型網站有持續的背景請求，導致 60 秒 timeout。

**正確做法**：
```typescript
// ✅ 使用 domcontentloaded + 可選的 load
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('load').catch(() => {});
```

#### 2. 自行實作反偵測程式碼

**錯誤**：手寫 50+ 行程式碼覆寫 `navigator.webdriver`、`navigator.plugins` 等。

**後果**：維護困難，且效果不如專業套件。

**正確做法**：使用 `playwright-extra` + `puppeteer-extra-plugin-stealth`，一行搞定。

#### 3. 使用 URL 參數進行分頁

**錯誤**：透過 `goto(url?pageNumber=N)` 切換評論頁面。

**後果**：Amazon 偵測到自動化行為，每頁返回相同的 10 則評論。

**正確做法**：模擬真實使用者，點擊「下一頁」按鈕：
```typescript
const nextButton = await page.$('li.a-last a');
await nextButton.scrollIntoViewIfNeeded();
await nextButton.click();
await randomDelay(2000, 4000);
```

#### 4. Review ID 提取策略不足

**錯誤**：僅使用 `element.getAttribute('id')` 取得 review_id。

**後果**：評論專頁的元素結構不同，所有評論 ID 為 null，fallback 產生相同 hash 導致去重失敗。

**正確做法**：多重 fallback 策略：
```typescript
// 1. 嘗試 id 屬性
let reviewId = await element.getAttribute('id');
// 2. 嘗試 data-review-id 屬性
if (!reviewId) reviewId = await element.getAttribute('data-review-id');
// 3. 嘗試子元素 id
if (!reviewId) {
  const el = await element.$('[id^="customer_review-"]');
  if (el) reviewId = await el.getAttribute('id');
}
// 4. 使用內容+日期做 hash（確保唯一性）
if (!reviewId) {
  const body = await getBodyText(element);
  const date = await getDateText(element);
  reviewId = `amz-${hash(body + '|' + date)}`;
}
```

#### 5. Hash 去重的內容選擇不當

**錯誤**：僅使用評論內文做 hash。

**後果**：如果內文擷取失敗（selector 不匹配），所有評論 hash 為 0，全部被視為重複。

**正確做法**：合併多個欄位（內文 + 日期 + 作者）做 hash，確保即使部分欄位為空也能產生不同值。

#### 6. 未考慮平台政策變更

**錯誤**：假設評論專頁 `/product-reviews/{ASIN}` 永遠可公開存取。

**後果**：Amazon 於 2026-02 改為需要登入，導致爬蟲失效。

**正確做法**：
- 實作登入機制作為備案
- 定期檢查平台政策變更
- 在 CLAUDE.md 記錄確認日期，方便追蹤
