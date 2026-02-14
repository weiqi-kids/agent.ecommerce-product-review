#!/bin/bash
#
# Best Buy US 評論抓取腳本
#
# 用法：
#   ./fetch.sh                    # 從 product_urls.txt 抓取
#   ./fetch.sh --sku 6505727      # 透過 SKU 抓取
#   ./fetch.sh --upc 012345678901 # 透過 UPC 搜尋並抓取
#   ./fetch.sh --search "Sony"    # 透過名稱搜尋
#   ./fetch.sh --discovery best-sellers electronics 50  # 商品發現
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SCRAPER_DIR="$PROJECT_ROOT/scrapers"
OUTPUT_DIR="$PROJECT_ROOT/docs/Extractor/bestbuy_us/raw"

# 預設參數
MAX_REVIEWS=100
BATCH_SIZE=50
HEADLESS=true

# 確保輸出目錄存在
mkdir -p "$OUTPUT_DIR"

cd "$SCRAPER_DIR"

# 處理命令列參數
if [[ "$1" == "--discovery" ]]; then
    # Discovery 模式：抓取排行榜
    SOURCE="${2:-best-sellers}"
    CATEGORY="${3:-electronics}"
    LIMIT="${4:-50}"
    DISCOVERY_DIR="$PROJECT_ROOT/docs/Extractor/bestbuy_us/discovery"

    mkdir -p "$DISCOVERY_DIR"

    echo "🔍 商品發現模式: source=$SOURCE, category=$CATEGORY, limit=$LIMIT"

    npx tsx src/bestbuy/discovery.ts \
        --source "$SOURCE" \
        --category "$CATEGORY" \
        --limit "$LIMIT" \
        --output "$DISCOVERY_DIR/bestbuy--${CATEGORY}--$(date +%Y-%m-%d).jsonl" \
        --headless "$HEADLESS"

    echo ""
    echo "✅ Discovery 完成"
    echo "📁 輸出檔案: $DISCOVERY_DIR/bestbuy--${CATEGORY}--$(date +%Y-%m-%d).jsonl"
    exit 0

elif [[ "$1" == "--sku" ]]; then
    # SKU 模式
    SKU="$2"
    echo "📦 透過 SKU 抓取: $SKU"
    npx tsx src/bestbuy/scraper.ts \
        --sku "$SKU" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

elif [[ "$1" == "--upc" ]]; then
    # UPC 搜尋模式
    UPC="$2"
    echo "🔍 透過 UPC 搜尋: $UPC"
    npx tsx src/bestbuy/scraper.ts \
        --upc "$UPC" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

elif [[ "$1" == "--search" ]]; then
    # 名稱搜尋模式
    QUERY="$2"
    echo "🔍 透過名稱搜尋: $QUERY"
    npx tsx src/bestbuy/scraper.ts \
        --search "$QUERY" \
        --output "$OUTPUT_DIR" \
        --max-reviews "$MAX_REVIEWS" \
        --batch-size "$BATCH_SIZE" \
        --headless "$HEADLESS"

elif [[ "$1" == "--url" ]]; then
    # 單一 URL 模式
    URL="$2"
    echo "📦 抓取單一產品: $URL"
    npx tsx src/bestbuy/scraper.ts \
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

    # 計算項目數量（URL 或 SKU）
    ITEM_COUNT=$(grep -cE '^(https|[0-9]{7})' "$URL_FILE" 2>/dev/null || echo 0)
    echo "📦 準備抓取 $ITEM_COUNT 個產品"

    # 逐行處理
    while IFS= read -r item || [[ -n "$item" ]]; do
        # 跳過空行和註解
        [[ -z "$item" || "$item" =~ ^# ]] && continue

        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # 判斷是 URL 還是 SKU
        if [[ "$item" =~ ^https ]]; then
            echo "🛒 $item"
            npx tsx src/bestbuy/scraper.ts \
                --url "$item" \
                --output "$OUTPUT_DIR" \
                --max-reviews "$MAX_REVIEWS" \
                --batch-size "$BATCH_SIZE" \
                --headless "$HEADLESS" \
                || echo "⚠️ 抓取失敗，繼續下一個..."
        elif [[ "$item" =~ ^[0-9]{7}$ ]]; then
            echo "🛒 SKU: $item"
            npx tsx src/bestbuy/scraper.ts \
                --sku "$item" \
                --output "$OUTPUT_DIR" \
                --max-reviews "$MAX_REVIEWS" \
                --batch-size "$BATCH_SIZE" \
                --headless "$HEADLESS" \
                || echo "⚠️ 抓取失敗，繼續下一個..."
        else
            echo "⚠️ 無法識別的格式: $item"
            continue
        fi

        # 隨機延遲避免被封鎖
        sleep $((RANDOM % 5 + 3))

    done < "$URL_FILE"
fi

echo ""
echo "✅ Best Buy 抓取完成"
echo "📁 輸出目錄: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.jsonl 2>/dev/null | tail -5 || echo "（無 JSONL 檔案）"
