#!/bin/bash
#
# Walmart US 評論抓取腳本
#
# 用法：
#   ./fetch.sh                    # 從 product_urls.txt 抓取
#   ./fetch.sh --upc 012345678901 # 透過 UPC 搜尋並抓取
#   ./fetch.sh --search "Sony"    # 透過名稱搜尋
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SCRAPER_DIR="$PROJECT_ROOT/scrapers"
OUTPUT_DIR="$PROJECT_ROOT/docs/Extractor/walmart_us/raw"

# 預設參數
MAX_REVIEWS=100
BATCH_SIZE=50
HEADLESS=true

# 確保輸出目錄存在
mkdir -p "$OUTPUT_DIR"

cd "$SCRAPER_DIR"

# 處理命令列參數
if [[ "$1" == "--upc" ]]; then
    # UPC 搜尋模式
    UPC="$2"
    echo "🔍 透過 UPC 搜尋: $UPC"
    npx tsx src/walmart/scraper.ts \
        --upc "$UPC" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

elif [[ "$1" == "--search" ]]; then
    # 名稱搜尋模式
    QUERY="$2"
    echo "🔍 透過名稱搜尋: $QUERY"
    npx tsx src/walmart/scraper.ts \
        --search "$QUERY" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

elif [[ "$1" == "--url" ]]; then
    # 單一 URL 模式
    URL="$2"
    echo "📦 抓取單一產品: $URL"
    npx tsx src/walmart/scraper.ts \
        --url "$URL" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

else
    # 從 product_urls.txt 批次抓取
    URL_FILE="$SCRIPT_DIR/product_urls.txt"

    if [[ ! -f "$URL_FILE" ]]; then
        echo "⚠️ product_urls.txt 不存在，建立空檔案"
        touch "$URL_FILE"
        exit 0
    fi

    # 計算 URL 數量
    URL_COUNT=$(grep -c '^https' "$URL_FILE" 2>/dev/null || echo 0)
    echo "📦 準備抓取 $URL_COUNT 個產品"

    # 逐行處理
    while IFS= read -r url || [[ -n "$url" ]]; do
        # 跳過空行和註解
        [[ -z "$url" || "$url" =~ ^# ]] && continue

        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🛒 $url"

        npx tsx src/walmart/scraper.ts \
            --url "$url" \
            --output "$OUTPUT_DIR" \
            --max-reviews "$MAX_REVIEWS" \
            --batch-size "$BATCH_SIZE" \
            --headless "$HEADLESS" \
            || echo "⚠️ 抓取失敗，繼續下一個..."

        # 隨機延遲避免被封鎖
        sleep $((RANDOM % 5 + 3))

    done < "$URL_FILE"
fi

echo ""
echo "✅ Walmart 抓取完成"
echo "📁 輸出目錄: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.jsonl 2>/dev/null | tail -5 || echo "（無 JSONL 檔案）"
