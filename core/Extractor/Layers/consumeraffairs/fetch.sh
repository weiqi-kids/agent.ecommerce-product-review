#!/bin/bash
# ConsumerAffairs Layer - 資料抓取腳本
# 模式：MCP fetch_url（無需授權）
# 注意：ConsumerAffairs 為投訴導向平台，負評偏高

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="consumeraffairs"
PLAN_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/fetch_plans"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

mkdir -p "$PLAN_DIR"

echo "📢 ConsumerAffairs Layer: 生成抓取計劃"

generate_fetch_plan() {
  local query="$1"
  local output_file="$2"

  cat > "$output_file" << EOF
{
  "layer": "consumeraffairs",
  "query": "${query}",
  "generated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "mode": "mcp_fetch",
  "platform_bias": "complaint_oriented",
  "search_queries": [
    "site:consumeraffairs.com \"${query}\""
  ],
  "instructions": {
    "step1": "使用 WebSearch: site:consumeraffairs.com \"${query}\"",
    "step2": "從搜尋結果中找到產品/品牌投訴頁面",
    "step3": "使用 MCP fetch_url 抓取投訴頁面",
    "step4": "萃取：投訴類型、嚴重程度、品牌回覆",
    "step5": "標記為「投訴導向平台」，輸出 JSONL"
  },
  "extract_fields": [
    "complaint_type",
    "severity",
    "brand_response",
    "resolution_status"
  ],
  "warnings": [
    "此平台負評比例自然偏高",
    "不適合計算整體滿意度",
    "適合識別常見問題和危機訊號"
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
  generate_fetch_plan "$QUERY" "$PLAN_DIR/consumeraffairs-${SAFE_NAME}-$(date +%Y-%m-%d).json"
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
    generate_fetch_plan "$line" "$PLAN_DIR/consumeraffairs-${SAFE_NAME}-$(date +%Y-%m-%d).json"
  done < "$QUERIES_FILE"

  echo "📊 已生成 $CURRENT 個抓取計劃"
fi

echo "📁 計劃位置：$PLAN_DIR"
echo "✅ ConsumerAffairs fetch 完成"
