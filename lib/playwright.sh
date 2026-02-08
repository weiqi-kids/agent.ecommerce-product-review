#!/usr/bin/env bash
# playwright.sh - Playwright 爬蟲 shell wrapper
# 注意：預期被其他 script 用 `source` 載入
# 不在這裡 set -euo pipefail，交給呼叫端決定。

if [[ -n "${PLAYWRIGHT_SH_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
PLAYWRIGHT_SH_LOADED=1

_playwright_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${_playwright_lib_dir}/core.sh"

########################################
# playwright_check_env
#
# 功能：
#   - 檢查 Playwright 環境是否就緒
#
# 回傳值：
#   0  = 環境就緒
#   >0 = 缺少依賴
########################################
playwright_check_env() {
  local err=0
  local project_root
  project_root="$(cd "${_playwright_lib_dir}/.." && pwd)"
  local scrapers_dir="$project_root/scrapers"

  # 檢查 Node.js
  if ! command -v node >/dev/null 2>&1; then
    echo "❌ [playwright_check_env] 缺少 Node.js" >&2
    err=1
  fi

  # 檢查 npx (用於執行 tsx)
  if ! command -v npx >/dev/null 2>&1; then
    echo "❌ [playwright_check_env] 缺少 npx" >&2
    err=1
  fi

  # 檢查 scrapers 目錄
  if [[ ! -d "$scrapers_dir" ]]; then
    echo "❌ [playwright_check_env] 找不到 scrapers/ 目錄" >&2
    err=1
  fi

  # 檢查 node_modules
  if [[ ! -d "$scrapers_dir/node_modules" ]]; then
    echo "⚠️  [playwright_check_env] 尚未安裝依賴，嘗試安裝..." >&2
    (cd "$scrapers_dir" && npm install) || {
      echo "❌ [playwright_check_env] npm install 失敗" >&2
      err=1
    }
  fi

  return "$err"
}

########################################
# playwright_scrape SCRAPER_NAME SOURCE_URL OUTPUT_DIR [OPTIONS...]
#
# 功能：
#   - 執行指定平台的 Playwright 爬蟲，抓取單一商品頁面
#
# 參數：
#   SCRAPER_NAME: 爬蟲名稱（對應 scrapers/src/{name}/scraper.ts）
#   SOURCE_URL: 商品頁面 URL
#   OUTPUT_DIR: JSONL 輸出目錄
#   OPTIONS: 可選參數
#     --locale LOCALE        語系（預設 en-US）
#     --max-reviews N        最多抓取評論數（預設 500）
#     --batch-size N         每行 JSONL 最多評論數（預設 50）
#     --headless BOOL        是否使用 headless 模式（預設 true）
#     --timeout MS           超時毫秒數（預設 30000）
#
# 回傳值：
#   0  = 成功
#   >0 = 失敗
########################################
playwright_scrape() {
  local scraper_name="$1"
  local source_url="$2"
  local output_dir="$3"
  shift 3

  # 解析可選參數
  local locale="${PLAYWRIGHT_LOCALE:-en-US}"
  local max_reviews="${PLAYWRIGHT_MAX_REVIEWS:-500}"
  local batch_size="${PLAYWRIGHT_BATCH_SIZE:-50}"
  local headless="${PLAYWRIGHT_HEADLESS:-true}"
  local timeout="${PLAYWRIGHT_TIMEOUT:-30000}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --locale)     locale="$2"; shift 2 ;;
      --max-reviews) max_reviews="$2"; shift 2 ;;
      --batch-size) batch_size="$2"; shift 2 ;;
      --headless)   headless="$2"; shift 2 ;;
      --timeout)    timeout="$2"; shift 2 ;;
      *) echo "⚠️  [playwright_scrape] 未知參數：$1" >&2; shift ;;
    esac
  done

  playwright_check_env || return 1

  local project_root
  project_root="$(cd "${_playwright_lib_dir}/.." && pwd)"
  local scraper_path="$project_root/scrapers/src/${scraper_name}/scraper.ts"

  if [[ ! -f "$scraper_path" ]]; then
    echo "❌ [playwright_scrape] 找不到爬蟲：$scraper_path" >&2
    return 1
  fi

  mkdir -p "$output_dir"

  echo "🕷️  [playwright_scrape] 執行爬蟲：$scraper_name" >&2
  echo "    URL: $source_url" >&2
  echo "    輸出: $output_dir" >&2
  echo "    語系: $locale | 最大評論: $max_reviews | 批次大小: $batch_size" >&2

  local exit_code=0
  (
    cd "$project_root/scrapers" && \
    npx tsx "$scraper_path" \
      --url "$source_url" \
      --output "$output_dir" \
      --locale "$locale" \
      --max-reviews "$max_reviews" \
      --batch-size "$batch_size" \
      --headless "$headless" \
      --timeout "$timeout"
  ) || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo "❌ [playwright_scrape] 爬蟲執行失敗 (exit=$exit_code)" >&2
    return 1
  fi

  echo "✅ [playwright_scrape] 完成：$scraper_name" >&2
  return 0
}

########################################
# playwright_scrape_urls --scraper NAME --input FILE --output DIR [OPTIONS...]
#
# 功能：
#   - 從 URL 清單檔案批次執行爬蟲
#
# 參數：
#   --scraper NAME     爬蟲名稱
#   --input FILE       URL 清單檔案（每行一個 URL，# 開頭為註解）
#   --output DIR       JSONL 輸出目錄
#   --locale LOCALE    語系（預設 en-US）
#   --max-reviews N    每個商品最多抓取評論數（預設 500）
#   --batch-size N     每行 JSONL 最多評論數（預設 50）
#
# 回傳值：
#   0  = 全部成功
#   1  = 部分或全部失敗
########################################
playwright_scrape_urls() {
  local scraper_name=""
  local input_file=""
  local output_dir=""
  local locale="en-US"
  local max_reviews=500
  local batch_size=50

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --scraper)     scraper_name="$2"; shift 2 ;;
      --input)       input_file="$2"; shift 2 ;;
      --output)      output_dir="$2"; shift 2 ;;
      --locale)      locale="$2"; shift 2 ;;
      --max-reviews) max_reviews="$2"; shift 2 ;;
      --batch-size)  batch_size="$2"; shift 2 ;;
      *) echo "⚠️  [playwright_scrape_urls] 未知參數：$1" >&2; shift ;;
    esac
  done

  if [[ -z "$scraper_name" || -z "$input_file" || -z "$output_dir" ]]; then
    echo "❌ [playwright_scrape_urls] 缺少必要參數：--scraper, --input, --output" >&2
    return 1
  fi

  if [[ ! -f "$input_file" ]]; then
    echo "❌ [playwright_scrape_urls] 找不到 URL 清單：$input_file" >&2
    return 1
  fi

  local total=0 success=0 failed=0

  while IFS= read -r url || [[ -n "$url" ]]; do
    # 跳過空行和註解
    [[ -z "$url" || "$url" == \#* ]] && continue

    # 去除前後空白
    url="$(echo "$url" | xargs)"
    [[ -z "$url" ]] && continue

    total=$((total + 1))

    if playwright_scrape "$scraper_name" "$url" "$output_dir" \
      --locale "$locale" \
      --max-reviews "$max_reviews" \
      --batch-size "$batch_size"; then
      success=$((success + 1))
    else
      failed=$((failed + 1))
      echo "⚠️  [playwright_scrape_urls] 失敗：$url" >&2
    fi
  done < "$input_file"

  # 記錄最後擷取時間
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$output_dir/.last_fetch"

  echo "📊 [playwright_scrape_urls] 結果：$success/$total 成功，$failed 失敗" >&2

  if [[ $failed -gt 0 ]]; then
    return 1
  fi
  return 0
}
