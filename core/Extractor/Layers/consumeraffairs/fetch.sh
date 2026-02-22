#!/bin/bash
# ConsumerAffairs Layer - 資料抓取腳本
# 注意：ConsumerAffairs 偏向投訴導向

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="consumeraffairs"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

mkdir -p "$RAW_DIR"

echo "📢 ConsumerAffairs Layer: 開始抓取（投訴資料）"

cd "$PROJECT_ROOT/scrapers"

QUERY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --query) QUERY="$2"; shift 2 ;;
    *) echo "未知參數: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$QUERY" ]]; then
  echo "  📝 產品: $QUERY"
  echo "  ⚠️ 請使用 WebSearch: site:consumeraffairs.com \"$QUERY\""
  exit 0
fi

if [[ -f "$QUERIES_FILE" ]]; then
  QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
  echo "  📋 共 $QUERY_COUNT 個產品查詢"

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    echo "  📢 $line"
    echo "    WebSearch: site:consumeraffairs.com \"$line\""
  done < "$QUERIES_FILE"
fi

echo "✅ ConsumerAffairs 查詢計劃完成"
