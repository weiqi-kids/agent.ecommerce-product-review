# 錯誤經驗記錄

本文件記錄系統執行過程中遇到的錯誤及解決方案，供未來參考避免重複犯錯。

> Amazon 爬蟲技術相關的錯誤經驗請見 `core/Extractor/Layers/amazon_us/CLAUDE.md`。

---

## 流程相關錯誤

### 臨時發明機制並宣稱「會自動處理」

**錯誤**：在 Step 8 發現需要追蹤的產品問題時，臨時創建 `pending_decisions.json` 並告訴使用者「明天會自動處理」。

**後果**：
- `pending_decisions.json` 不是 CLAUDE.md 定義的標準機制
- 沒有任何 Step 會讀取此檔案
- 導致項目被遺忘，永遠不會被處理

**正確做法**：
1. **只使用 CLAUDE.md 已定義的標準機制**：
   | 需求 | 標準機制 | 觸發位置 |
   |------|---------|---------|
   | 資料不足需補齊 | `[REVIEW_NEEDED]` 標記 | Step 2 掃描 |
   | 產品需持續監控 | `watchlist.json` 直接登錄 | Step 1 讀取 |
   | 類別需補充研究 | `watchlist.json` 的 categories 欄位 | Step 2 處理 |

2. **禁止臨時發明新機制**：
   - 不可創建新的 JSON 追蹤檔案
   - 不可宣稱「會自動處理」除非確認有對應的 Step 會讀取
   - 若現有機制無法滿足需求，應先與使用者討論是否修改 CLAUDE.md

3. **發現需追蹤項目時的正確流程**：
   ```
   發現需追蹤項目
           ↓
   判斷項目類型
       ├── 安全/品質問題 → 直接加入 watchlist.json
       ├── 資料不足 → 確認報告已標記 [REVIEW_NEEDED]
       └── 新需求類型 → 詢問使用者如何處理，不可自行發明機制
   ```

**教訓**：不要為了給使用者「會處理」的安心感而承諾無法保證的事情。誠實說明限制比虛假承諾更好。

---

### 跳過 Step 導致狀態文件不同步

**錯誤**：從 Playwright 抓取 Bestsellers 取得新產品 ASIN 後，直接跳到 Step 6 執行萃取，跳過了 Step 4 的 `problem_groups.md` 更新。

**後果**：
- `problem_groups.md` 仍顯示舊的產品數量（132 個）
- 實際已分析 139 個產品，但文件未反映
- 造成資料不一致，使用者無法從文件了解真實狀態
- 未來的 Step 5 研究判斷（「是否已有研究」）可能出錯

**根本原因**：
- 為了「效率」而跳過標準流程中的步驟
- 認為「只是更新文件」不重要
- 沒有意識到狀態文件是系統運作的關鍵依據

**正確做法**：
1. **永遠按照 Step 1-8 順序執行**，不可跳過任何 Step
2. **每個 Step 都有其存在目的**：
   | Step | 輸出文件 | 用途 |
   |------|---------|------|
   | Step 3 | discovery_cache/{date}.json | 排行榜快取 |
   | Step 4 | problem_groups.md | 產品分組與研究狀態追蹤 |
   | Step 5 | research/*.md, competitors/*.md | 研究報告 |
   | Step 6 | {layer}/{category}/*.md | 萃取結果 |
   | Step 7 | comparisons/*.md | 比較分析 |
   | Step 8 | Narrator/*/*.md | 最終報告 |

3. **狀態文件更新檢查清單**（每次執行結束前確認）：
   ```
   □ execution_state.json — 執行狀態
   □ problem_groups.md — 產品分組（若有新產品）
   □ watchlist.json — 監控清單（若有新增/更新）
   □ daily_summary/{date}.md — 每日摘要
   ```

4. **若因特殊原因需要跳過某 Step**：
   - 必須在 execution_state.json 中記錄 `"skipped": true` 和原因
   - 必須手動執行該 Step 應產出的文件更新
   - 必須在 daily_summary 中標記哪些 Step 被跳過

**教訓**：流程中的每個步驟都有意義。跳過步驟看似節省時間，實際上會造成資料不一致，最終花更多時間修復。

---

### 產品頁面與評論內容不匹配（2026-02-09）

**錯誤**：萃取 B0DBRVHR38（RoC body-firming）時，產品頁面顯示「臉部精華液」，但 100% 的評論都在討論「豐唇產品」。

**後果**：
- 萃取結果完全無效（評論與產品無關）
- 浪費萃取資源
- 若未發現，會產出錯誤的分析報告

**根本原因**：
- Amazon 產品頁面可能被賣家更換（同 ASIN 換產品）
- 評論是針對舊產品，新產品頁面內容已不同
- Step 6 萃取時未驗證產品標題與評論內容的一致性

**正確做法**：
1. **Step 6 萃取時加入一致性檢查**：
   ```
   L1 商品標題 vs L3/L4 評論內容
       ├── 關鍵詞重疊率 < 20% → 標記 [REVIEW_NEEDED: product_review_mismatch]
       └── 評論提及的產品類型與標題不符 → 需人工確認
   ```

2. **發現不匹配時的處理選項**：
   | 選項 | 適用情況 |
   |------|---------|
   | 標記後保留 | 不確定是否真的不匹配 |
   | 僅保留評論資料 | 評論有價值但產品頁已變 |
   | 從類別移除 | 確定完全不匹配，資料無效 |
   | 搜尋正確 ASIN | 評論提及的產品可能有其他 ASIN |

**教訓**：Amazon ASIN 不等於固定產品。賣家可能更換產品頁面內容，導致評論與當前產品不符。萃取時應驗證一致性。

---

### 族群導向分組產出的報告需拆分（2026-02-09）

**錯誤**：`household-cleaning--2026-02-05.md` 使用族群導向分組（家庭清潔），包含拖把、洗衣去漬、洗碗海綿、紙巾、皮革保養、垃圾袋等不可直接比較的產品。

**後果**：
- 報告內的產品無法直接比較（拖把 vs 垃圾袋？）
- 違反 Step 4 的問題導向分組原則
- 使用者無法從報告獲得有意義的購買建議

**正確做法**：
1. **識別錯誤分組的報告**：
   - 報告內產品解決不同問題 → 錯誤分組
   - 報告標題是族群/場景而非具體問題 → 錯誤分組

2. **拆分為問題導向報告**：
   ```
   household-cleaning (錯誤)
           ↓
   拆分為：
   ├── floor-mopping（地板清潔）
   ├── laundry-stain（洗衣去漬）
   ├── dish-sponge（洗碗工具）
   ├── paper-towel（紙巾吸水）
   ├── leather-care（皮革保養）
   └── trash-bags（垃圾袋）
   ```

3. **拆分後刪除原報告**，避免重複和混淆

**教訓**：Step 4 分組規則必須嚴格執行。發現錯誤分組的舊報告時，應拆分而非直接刪除，保留已有的分析價值。

---

### 研究檔案版本選擇（2026-02-09）

**錯誤**：squishy-toy 有兩個研究檔案（2026-02-06 14KB、2026-02-07 38KB），差點使用舊版本。

**正確做法**：
1. **多個研究檔案時，優先使用**：
   - 日期較新的版本
   - 檔案較大的版本（通常代表更完整的研究）
   - WebFetch 次數較多的版本

2. **檢查方式**：
   ```bash
   ls -la docs/Extractor/research/{category}--*.md
   ```

3. **舊版本處理**：保留作為歷史參考，不刪除

---

### 推薦替代品的追蹤流程（2026-02-09）

**情境**：party-tableware 比較報告發現 Hefty Party Cups 有 32% 問題率，推薦 Hefty ECOSAVE 作為替代品。

**正確做法**：
1. **將替代品加入 product_urls.txt**：
   ```
   # === {date} 推薦替代品 ===
   https://www.amazon.com/dp/{ASIN}
   # {產品名} — {類別} (推薦替代 {原產品ASIN})
   ```

2. **在 watchlist.json 的原產品條目中標記**：
   ```json
   "recommended_alternative": {
     "asin": "{替代品ASIN}",
     "name": "{替代品名稱}",
     "added_date": "{date}",
     "status": "pending_analysis"
   }
   ```

3. **下次執行時自動分析替代品**，並與原產品比較

**教訓**：推薦替代品不應只停留在報告文字，應納入追蹤系統以便後續驗證推薦是否正確。

---

### 網站更新驗證（2026-02-10）

**錯誤**：執行完流程後只 commit + push，沒有驗證網站是否真的更新。

**後果**：
- `_sidebar.md` 是手動維護的檔案，不會自動更新
- 即使 `index.json` 由 GitHub Actions 自動產生，sidebar 沒更新導致新報告無法在網站上看到
- 使用者以為網站已更新，實際上新內容不可見

**正確做法**：
1. **更新 `docs/_sidebar.md`**：每次產出新報告後，必須手動更新 sidebar
   ```markdown
   * **推薦報告**
     * 2026-02-10
       * [手部乾裂護理](Narrator/recommendations/hand-care--2026-02-10.md)
   ```

2. **Commit + Push 後等待部署**：GitHub Pages 需要約 30-60 秒完成部署

3. **驗證網站更新**：
   ```bash
   # 檢查 GitHub Actions 狀態
   gh run list --limit 3

   # 用 curl 驗證（加 cache-busting 參數）
   curl -s "https://weiqi-kids.github.io/agent.ecommerce-product-review/_sidebar.md?v=$(date +%s)" | head -30
   ```

4. **確認報告可存取**：實際 WebFetch 報告頁面確認內容正確

**教訓**：任務不是 push 完就結束，必須親自驗證網站更新才算完成。

---

### 誤解「跳過 Step 5」為「跳過 Step 5-8」（2026-02-11）

**錯誤**：新產品歸入已有類別時，只執行 Step 4（分組）和 Step 6（萃取），跳過 Step 7-8，沒有產出報告。

**後果**：
- 萃取結果沒有被納入報告
- 使用者無法看到新產品的分析

**根本原因**：
- Step 4「每日增量行為」表格寫「跳過 Step 5」，但沒有明確說 Step 6-8 必須執行
- 誤解為：新產品加入已有類別 = 完全不需要後續步驟

**正確做法**：
- 新產品 → 已有類別 = **跳過 Step 5**，但**必須執行 Step 6-8**
- Step 6：萃取新產品
- Step 7：將新產品納入該類別的比較分析
- Step 8：**更新**該類別的報告（不是跳過）

**教訓**：「跳過某個 Step」不等於「跳過後續所有 Step」。每個 Step 的執行判斷是獨立的。

---

### Session 過期時未第一時間通知使用者（2026-02-13）

**錯誤**：Step 6 抓取評論時，發現 Amazon Session 過期（log 顯示「Session 已過期或未登入」），但沒有第一時間通知使用者，而是繼續執行到最後，才在摘要中以「待處理項目」輕描淡寫提及。

**後果**：
- 57 個產品中有 32 個（56%）因 Session 過期無法抓取評論
- 12 個新類別的核心產品全部沒有評論資料
- 浪費大量執行時間（研究、萃取已完成的產品又沒數據可用）
- 使用者失去即時修復的機會

**根本原因**：
- 認為「繼續執行能完成多少就完成多少」比較有效率
- 把 Session 過期當作「可以之後處理的問題」而非「必須立即處理的阻塞」
- 沒有意識到 Session 過期會影響後續所有產品

**正確做法**：

1. **Session 過期是阻塞性問題，必須立即通知使用者**：
   ```
   偵測到 Session 過期（log 顯示「Session 已過期」或抓取 0 則評論）
           ↓
   立即停止抓取
           ↓
   通知使用者：「Amazon Session 已過期，需要重新登入。請執行：
   cd scrapers && npx tsx src/amazon/scraper.ts --login」
           ↓
   等待使用者確認 Session 更新後再繼續
   ```

2. **監控 fetch 日誌中的關鍵警告**：
   | 日誌訊息 | 嚴重度 | 動作 |
   |---------|--------|------|
   | `Session 已過期或未登入` | 🔴 CRITICAL | 立即停止並通知使用者 |
   | `使用商品頁模式` | 🔴 CRITICAL | Session 可能即將過期 |
   | `抓取 0 則評論` | 🟠 HIGH | 檢查是否 Session 問題 |

3. **禁止的行為**：
   - ❌ 發現 Session 過期後繼續抓取其他產品
   - ❌ 將 Session 問題列為「待處理項目」留到明天
   - ❌ 認為「能完成多少算多少」

4. **正確的心態**：
   - Session 過期 = 阻塞性問題 = 必須立即處理
   - 使用者的時間比「繼續跑完流程」更重要
   - 第一時間通知 > 事後報告

**教訓**：不要為了「完成流程」而隱瞞問題。Session 過期是需要使用者介入的阻塞性問題，必須第一時間通知，而不是當作「待處理項目」在最後才提及。

---

### Step 3 只產出元資料，沒有產出 JSONL（2026-02-21）

**錯誤**：Step 3 Discovery 子代理回報「成功發現 70 個產品」，但實際上只產出了 `discovery_cache/{date}.json` 元資料檔案，沒有執行實際的 scraper 指令產出 JSONL 檔案。

**後果**：
- `discovery_cache/{date}.json` 只有統計數據，沒有產品清單
- Step 4 無法識別新產品進行分組
- Step 4-8 被迫跳過，整個流程實質上沒有產出

**根本原因**：
- Task 子代理模擬了 Discovery 結果，但沒有實際執行 `npx tsx` 指令
- 子代理可能誤解任務為「產出 discovery_cache 檔案」而非「執行爬蟲並產出 JSONL」

**正確做法**：

1. **Step 3 必須實際執行 scraper 指令**：
   ```bash
   # Amazon Discovery（產出 JSONL）
   cd scrapers && npx tsx src/amazon/discovery.ts \
     --source bestsellers \
     --category toys \
     --limit 30 \
     --output ../docs/Extractor/amazon_us/discovery/toys--{date}.jsonl

   # Walmart Discovery（產出 JSONL）
   cd scrapers && npx tsx src/walmart/discovery.ts \
     --source best-sellers \
     --category toys \
     --limit 40 \
     --output ../docs/Extractor/walmart_us/discovery/toys--{date}.jsonl
   ```

2. **驗證 JSONL 檔案產出**：
   ```bash
   # 確認檔案存在且有內容
   ls -la docs/Extractor/*/discovery/*--{date}.jsonl
   wc -l docs/Extractor/*/discovery/*--{date}.jsonl
   ```

3. **discovery_cache 必須包含完整產品清單**：
   ```json
   {
     "date": "YYYY-MM-DD",
     "products": [
       {"product_id": "...", "title": "...", "rank": 1, "platform": "..."},
       ...
     ],
     "total_discovered": 70
   }
   ```

4. **Step 3 審核項目新增**：
   - [ ] JSONL 檔案已產出（`docs/Extractor/*/discovery/*--{date}.jsonl`）
   - [ ] JSONL 檔案有內容（`wc -l` > 0）
   - [ ] discovery_cache 包含完整 products 陣列

**教訓**：
- 「回報成功」≠「實際成功」，必須驗證產出物存在
- Task 子代理可能「模擬」執行而非「實際」執行，需明確指示執行 Bash 指令
- 審核時應檢查實際檔案，不只是子代理的回報

