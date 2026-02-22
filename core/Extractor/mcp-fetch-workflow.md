# MCP Fetcher 工作流程

## 概述

社群來源 Layers 使用 MCP `fetch_url` / `fetch_urls` 工具抓取網頁，**無需每次授權**。

## 可用工具

| 工具 | 說明 | 授權 |
|------|------|------|
| `fetch_url` | 抓取單一 URL，回傳 Markdown | ✅ 不需要 |
| `fetch_urls` | 批次抓取多個 URL | ✅ 不需要 |

## Layer 分類

### 類型 A：Playwright 自動化（無需 MCP）

| Layer | 工具 | 說明 |
|-------|------|------|
| amazon_us | Playwright | 已有登入 Session |
| bestbuy_us | Playwright | 無需登入 |
| walmart_us | - | 被 PerimeterX 封鎖 |

### 類型 B：CLI 工具（無需 MCP）

| Layer | 工具 | 說明 |
|-------|------|------|
| youtube | yt-dlp | 命令列工具，完全自動 |

### 類型 C：API 優先，MCP 備援

| Layer | 主要工具 | 備援 |
|-------|---------|------|
| reddit | Reddit API | MCP fetcher |

### 類型 D：MCP Fetcher（主要）

| Layer | 說明 |
|-------|------|
| trustpilot | 品牌評價頁面 |
| consumeraffairs | 投訴頁面 |
| headfi | 論壇討論串 |
| avsforum | 論壇討論串 |
| slickdeals | 促銷討論 |
| makeupalley | 美妝評價 |
| babycenter | 父母討論 |

## 執行流程

### Step 1: 生成抓取計劃

```bash
# fetch.sh 輸出 JSON 抓取計劃
./fetch.sh --query "Mighty Patch" --output-plan

# 輸出：fetch_plan.json
{
  "layer": "trustpilot",
  "query": "Mighty Patch",
  "urls": [
    "https://www.trustpilot.com/review/hero-cosmetics.com",
    ...
  ],
  "search_queries": [
    "site:trustpilot.com Hero Cosmetics"
  ]
}
```

### Step 2: Claude 執行抓取（使用 MCP）

Claude 讀取抓取計劃，使用 MCP 工具執行：

```
1. 若有 search_queries：
   - 使用 WebSearch 搜尋（這部分仍需要，但次數較少）
   - 從結果中提取 URL

2. 對每個 URL 使用 MCP fetch_url：
   - 調用 fetch_url(url)
   - 無需授權，直接執行
   - 回傳 Markdown 內容

3. 處理內容：
   - AI 萃取相關資訊
   - 輸出 JSONL
```

### Step 3: 萃取與更新

```bash
# 正常的萃取流程
# L1-L6 萃取 → .md 輸出 → update.sh
```

## MCP 批次抓取範例

對於需要抓取多個 URL 的情況：

```
使用 fetch_urls 工具：
- urls: ["url1", "url2", "url3", ...]
- 一次抓取多個，提升效率
- 回傳陣列，每個元素為對應 URL 的 Markdown 內容
```

## 與 WebFetch 的差異

| 特性 | WebFetch | MCP fetch_url |
|------|----------|---------------|
| 授權 | ⚠️ 每次都要 | ✅ 不需要 |
| JavaScript 渲染 | ❌ | ✅ (Playwright) |
| 批次處理 | ❌ | ✅ fetch_urls |
| 速度 | 較快 | 稍慢（渲染） |

## 實作注意事項

1. **URL 必須來自搜尋結果**
   - 不可猜測 URL
   - 先用 WebSearch，再用 MCP fetch

2. **錯誤處理**
   - 若 URL 404 或超時，跳過並記錄
   - 不中斷整體流程

3. **速率限制**
   - 每次批次最多 10 個 URL
   - 批次間間隔 2-3 秒

## Layer 執行指令

### 類型 D Layers（MCP Fetcher）

```bash
# 1. 生成抓取計劃
./core/Extractor/Layers/trustpilot/fetch.sh --query "Hero Cosmetics" --output-plan

# 2. Claude 讀取計劃並執行 MCP fetch
#    （由 Claude 在執行流程中自動處理）

# 3. 萃取完成後執行 update
./core/Extractor/Layers/trustpilot/update.sh docs/Extractor/trustpilot/*.md
```
