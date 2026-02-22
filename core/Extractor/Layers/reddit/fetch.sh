#!/bin/bash
# Reddit Layer - 資料抓取腳本
#
# 使用方式：
#   ./fetch.sh                    # 從 product_queries.txt 抓取
#   ./fetch.sh --query "AirPods"  # 指定產品名稱
#   ./fetch.sh --subreddits "headphones,audiophile"  # 指定 subreddits
#
# 環境變數：
#   REDDIT_CLIENT_ID     - Reddit API Client ID
#   REDDIT_CLIENT_SECRET - Reddit API Client Secret

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# 載入共用函式庫
source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="reddit"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

# 預設值
MAX_POSTS=50
RELEVANCE_THRESHOLD=0.7

# 解析參數
QUERY=""
SUBREDDITS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query)
      QUERY="$2"
      shift 2
      ;;
    --subreddits)
      SUBREDDITS="$2"
      shift 2
      ;;
    --max-posts)
      MAX_POSTS="$2"
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

echo "🔍 Reddit Layer: 開始抓取"

# 檢查 Reddit API 憑證
if [[ -z "${REDDIT_CLIENT_ID:-}" ]] || [[ -z "${REDDIT_CLIENT_SECRET:-}" ]]; then
  echo "⚠️  未設定 Reddit API 憑證，使用 WebSearch fallback 模式"
  USE_API=false
else
  USE_API=true
fi

# 進入 scrapers 目錄
cd "$PROJECT_ROOT/scrapers"

# 單一查詢模式
if [[ -n "$QUERY" ]]; then
  echo "  📝 查詢: $QUERY"

  ARGS="--query \"$QUERY\" --output \"$RAW_DIR\" --max-posts $MAX_POSTS"

  if [[ -n "$SUBREDDITS" ]]; then
    ARGS="$ARGS --subreddits \"$SUBREDDITS\""
  fi

  if [[ "$USE_API" == "true" ]]; then
    ARGS="$ARGS --use-api"
  fi

  eval "npx tsx src/reddit/scraper.ts $ARGS" || {
    echo "  ⚠️ 抓取失敗: $QUERY"
  }

  echo "✅ Reddit 抓取完成"
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

  ARGS="--query \"$line\" --output \"$RAW_DIR\" --max-posts $MAX_POSTS"

  if [[ "$USE_API" == "true" ]]; then
    ARGS="$ARGS --use-api"
  fi

  eval "npx tsx src/reddit/scraper.ts $ARGS" || {
    echo "    ⚠️ 抓取失敗"
  }

  # 隨機延遲 5-15 秒，避免觸發限流
  DELAY=$((RANDOM % 10 + 5))
  sleep $DELAY

done < "$QUERIES_FILE"

echo "✅ Reddit 抓取完成: $CURRENT 個產品"
