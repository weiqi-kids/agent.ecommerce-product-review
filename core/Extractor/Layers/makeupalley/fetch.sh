#!/bin/bash
# makeupalley Layer - 資料抓取腳本
# 模式：MCP fetch_url（無需授權）
# 美妝評價論壇

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="makeupalley"
PLAN_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/fetch_plans"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

mkdir -p "$PLAN_DIR"

echo "💄 makeupalley Layer: 生成抓取計劃"

generate_fetch_plan() {
  local query="$1"
  local output_file="$2"

  cat > "$output_file" << EOF
{
  "layer": "makeupalley",
  "query": "${query}",
  "generated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "mode": "mcp_fetch",
  "forum_domain": "makeupalley.com",
  "category": "beauty",
  "search_queries": [
    "site:makeupalley.com \"${query}\" review",
    "site:makeupalley.com \"${query}\" impressions"
  ],
  "instructions": {
    "step1": "使用 WebSearch: site:makeupalley.com \"${query}\"",
    "step2": "從搜尋結果中提取論壇討論串 URL",
    "step3": "使用 MCP fetch_url 抓取每個討論串",
    "step4": "AI 萃取產品相關討論，輸出 JSONL"
  }
}
EOF
  echo "  📝 抓取計劃：$output_file"
}

QUERY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --query) QUERY="$2"; shift 2 ;;
    *) echo "未知參數: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$QUERY" ]]; then
  SAFE_NAME=$(echo "$QUERY" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
  generate_fetch_plan "$QUERY" "$PLAN_DIR/makeupalley-${SAFE_NAME}-$(date +%Y-%m-%d).json"
  exit 0
fi

if [[ -f "$QUERIES_FILE" ]]; then
  QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
  echo "  📋 共 $QUERY_COUNT 個產品查詢"

  CURRENT=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    CURRENT=$((CURRENT + 1))
    SAFE_NAME=$(echo "$line" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
    generate_fetch_plan "$line" "$PLAN_DIR/makeupalley-${SAFE_NAME}-$(date +%Y-%m-%d).json"
  done < "$QUERIES_FILE"

  echo "📊 已生成 $CURRENT 個抓取計劃"
fi

echo "📁 計劃位置：$PLAN_DIR"
echo "✅ makeupalley fetch 完成"
