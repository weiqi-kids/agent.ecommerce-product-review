#!/bin/bash
# Reddit Layer - 資料抓取腳本
#
# 使用方式：
#   ./fetch.sh --query "AirPods"              # 生成抓取計劃
#   ./fetch.sh --query "AirPods" --use-api    # 使用 Reddit API（需設定環境變數）
#
# 模式：
#   1. API 模式：設定 REDDIT_CLIENT_ID/SECRET 後自動啟用
#   2. MCP 模式：輸出抓取計劃，由 Claude 使用 MCP fetch_url 執行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="reddit"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
PLAN_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/fetch_plans"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

# 預設值
MAX_POSTS=50
USE_API=false

# 解析參數
QUERY=""
OUTPUT_PLAN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query)
      QUERY="$2"
      shift 2
      ;;
    --use-api)
      USE_API=true
      shift
      ;;
    --output-plan)
      OUTPUT_PLAN=true
      shift
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
mkdir -p "$RAW_DIR" "$PLAN_DIR"

echo "🔍 Reddit Layer: 開始處理"

# 檢查 Reddit API 憑證
if [[ -n "${REDDIT_CLIENT_ID:-}" ]] && [[ -n "${REDDIT_CLIENT_SECRET:-}" ]]; then
  echo "  ✅ Reddit API 憑證已設定"
  HAS_API=true
else
  echo "  ⚠️  Reddit API 未設定，將使用 MCP fetcher 模式"
  HAS_API=false
fi

# 生成搜尋查詢
generate_search_queries() {
  local query="$1"
  cat << EOF
site:reddit.com "${query}" review
site:reddit.com "${query}" worth it
site:reddit.com "${query}" problems
site:reddit.com "${query}" recommendation
site:reddit.com "${query}" after 1 year
EOF
}

# 生成抓取計劃 JSON
generate_fetch_plan() {
  local query="$1"
  local output_file="$2"

  # 根據產品類別選擇 subreddits
  local subreddits='["SkincareAddiction", "MakeupAddiction", "headphones", "gadgets", "BuyItForLife"]'

  cat > "$output_file" << EOF
{
  "layer": "reddit",
  "query": "${query}",
  "generated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "mode": "mcp_fetch",
  "search_queries": [
    "site:reddit.com \"${query}\" review",
    "site:reddit.com \"${query}\" worth it",
    "site:reddit.com \"${query}\" problems"
  ],
  "target_subreddits": ${subreddits},
  "max_posts": ${MAX_POSTS},
  "instructions": {
    "step1": "使用 WebSearch 執行 search_queries 中的查詢",
    "step2": "從搜尋結果中提取 Reddit URL",
    "step3": "使用 MCP fetch_url 抓取每個 Reddit 討論串",
    "step4": "AI 萃取產品相關討論，輸出 JSONL"
  }
}
EOF
  echo "  📝 抓取計劃已生成：$output_file"
}

# 單一查詢模式
if [[ -n "$QUERY" ]]; then
  echo "  📝 查詢: $QUERY"

  if [[ "$HAS_API" == "true" ]] && [[ "$USE_API" == "true" ]]; then
    # 使用 Reddit API
    echo "  📡 使用 Reddit API 模式"
    cd "$PROJECT_ROOT/scrapers"
    npx tsx src/reddit/scraper.ts \
      --query "$QUERY" \
      --output "$RAW_DIR" \
      --max-posts "$MAX_POSTS" \
      --use-api || {
      echo "  ⚠️ API 抓取失敗，切換到 MCP 模式"
      generate_fetch_plan "$QUERY" "$PLAN_DIR/reddit-$(echo "$QUERY" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')-$(date +%Y-%m-%d).json"
    }
  else
    # 輸出 MCP 抓取計劃
    echo "  📋 生成 MCP 抓取計劃"
    generate_fetch_plan "$QUERY" "$PLAN_DIR/reddit-$(echo "$QUERY" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')-$(date +%Y-%m-%d).json"
  fi

  echo "✅ Reddit 處理完成"
  exit 0
fi

# 批次模式：從 product_queries.txt 讀取
if [[ ! -f "$QUERIES_FILE" ]]; then
  echo "❌ 找不到 $QUERIES_FILE" >&2
  exit 1
fi

QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
echo "  📋 共 $QUERY_COUNT 個產品查詢"

CURRENT=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue

  CURRENT=$((CURRENT + 1))
  echo "  [$CURRENT/$QUERY_COUNT] $line"

  # 生成抓取計劃
  SAFE_NAME=$(echo "$line" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
  generate_fetch_plan "$line" "$PLAN_DIR/reddit-${SAFE_NAME}-$(date +%Y-%m-%d).json"

done < "$QUERIES_FILE"

echo ""
echo "📊 已生成 $CURRENT 個抓取計劃"
echo "📁 計劃位置：$PLAN_DIR"
echo ""
echo "下一步：Claude 將讀取這些計劃並使用 MCP fetch_url 執行抓取"
echo "✅ Reddit fetch 完成"
