#!/bin/bash
# Trustpilot Layer - 資料抓取腳本
# 模式：MCP fetch_url（無需授權）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="trustpilot"
PLAN_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/fetch_plans"
QUERIES_FILE="$SCRIPT_DIR/brand_queries.txt"

mkdir -p "$PLAN_DIR"

echo "🏢 Trustpilot Layer: 生成抓取計劃"

# 生成抓取計劃 JSON
generate_fetch_plan() {
  local query="$1"
  local output_file="$2"
  local slug=$(echo "$query" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

  cat > "$output_file" << EOF
{
  "layer": "trustpilot",
  "query": "${query}",
  "generated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "mode": "mcp_fetch",
  "search_queries": [
    "site:trustpilot.com \"${query}\""
  ],
  "expected_url_pattern": "trustpilot.com/review/{domain}",
  "data_type": "brand_reviews",
  "instructions": {
    "step1": "使用 WebSearch: site:trustpilot.com \"${query}\"",
    "step2": "找到品牌頁面 URL（格式：trustpilot.com/review/xxx.com）",
    "step3": "使用 MCP fetch_url 抓取品牌頁面",
    "step4": "萃取：TrustScore、評論數、最新評論",
    "step5": "輸出 JSONL"
  },
  "extract_fields": [
    "trust_score",
    "total_reviews",
    "rating_distribution",
    "recent_reviews"
  ]
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
  generate_fetch_plan "$QUERY" "$PLAN_DIR/trustpilot-${SAFE_NAME}-$(date +%Y-%m-%d).json"
  exit 0
fi

if [[ -f "$QUERIES_FILE" ]]; then
  QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
  echo "  📋 共 $QUERY_COUNT 個品牌查詢"

  CURRENT=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    CURRENT=$((CURRENT + 1))
    SAFE_NAME=$(echo "$line" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
    generate_fetch_plan "$line" "$PLAN_DIR/trustpilot-${SAFE_NAME}-$(date +%Y-%m-%d).json"
  done < "$QUERIES_FILE"

  echo "📊 已生成 $CURRENT 個抓取計劃"
fi

echo "📁 計劃位置：$PLAN_DIR"
echo "✅ Trustpilot fetch 完成"
