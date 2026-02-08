#!/bin/bash
# amazon_us 資料擷取腳本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
source "$PROJECT_ROOT/lib/playwright.sh"

LAYER_NAME="amazon_us"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
URLS_FILE="$SCRIPT_DIR/product_urls.txt"

mkdir -p "$RAW_DIR"

# 檢查 URL 清單是否存在
if [[ ! -f "$URLS_FILE" ]]; then
  echo "❌ 找不到 product_urls.txt：$URLS_FILE" >&2
  exit 1
fi

# 計算有效 URL 數量（排除空行和註解）
URL_COUNT=$(grep -cvE '^\s*(#|$)' "$URLS_FILE" 2>/dev/null || echo "0")
echo "🛒 Amazon US: 準備擷取 $URL_COUNT 個商品"

# 執行爬蟲
playwright_scrape_urls \
  --scraper "amazon" \
  --input "$URLS_FILE" \
  --output "$RAW_DIR" \
  --locale "en-US" \
  --max-reviews 500 \
  --batch-size 50

echo "✅ Fetch completed: $LAYER_NAME"
