#!/bin/bash
# YouTube Layer - 資料抓取腳本
#
# 使用方式：
#   ./fetch.sh                      # 從 product_queries.txt 抓取
#   ./fetch.sh --query "AirPods"    # 指定產品名稱
#   ./fetch.sh --max-videos 10      # 限制影片數量
#
# 前置需求：
#   brew install yt-dlp
#   或
#   pip install yt-dlp

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# 載入共用函式庫
source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="youtube"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

# 預設值
MAX_VIDEOS=15
MAX_COMMENTS=100

# 解析參數
QUERY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query)
      QUERY="$2"
      shift 2
      ;;
    --max-videos)
      MAX_VIDEOS="$2"
      shift 2
      ;;
    --max-comments)
      MAX_COMMENTS="$2"
      shift 2
      ;;
    *)
      echo "未知參數: $1" >&2
      exit 1
      ;;
  esac
done

# 確保輸出目錄存在
mkdir -p "$RAW_DIR"

# 檢查 yt-dlp 是否安裝
if ! command -v yt-dlp &> /dev/null; then
  echo "❌ yt-dlp 未安裝。請執行：brew install yt-dlp" >&2
  exit 1
fi

echo "🎬 YouTube Layer: 開始抓取"

# 進入 scrapers 目錄
cd "$PROJECT_ROOT/scrapers"

# 單一查詢模式
if [[ -n "$QUERY" ]]; then
  echo "  📝 查詢: $QUERY"

  npx tsx src/youtube/scraper.ts \
    --query "$QUERY" \
    --output "$RAW_DIR" \
    --max-videos "$MAX_VIDEOS" \
    --max-comments "$MAX_COMMENTS" || {
    echo "  ⚠️ 抓取失敗: $QUERY"
  }

  echo "✅ YouTube 抓取完成"
  exit 0
fi

# 批次模式：從 product_queries.txt 讀取
if [[ ! -f "$QUERIES_FILE" ]]; then
  echo "❌ 找不到 $QUERIES_FILE" >&2
  exit 1
fi

# 計算查詢數量
QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
echo "  📋 共 $QUERY_COUNT 個產品查詢"

CURRENT=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # 跳過空行和註解
  [[ -z "$line" || "$line" == \#* ]] && continue

  CURRENT=$((CURRENT + 1))
  echo "  [$CURRENT/$QUERY_COUNT] $line"

  npx tsx src/youtube/scraper.ts \
    --query "$line" \
    --output "$RAW_DIR" \
    --max-videos "$MAX_VIDEOS" \
    --max-comments "$MAX_COMMENTS" || {
    echo "    ⚠️ 抓取失敗"
  }

  # 隨機延遲 5-10 秒，避免觸發限流
  DELAY=$((RANDOM % 5 + 5))
  sleep $DELAY

done < "$QUERIES_FILE"

echo "✅ YouTube 抓取完成: $CURRENT 個產品"
