#!/bin/bash
# Trustpilot Layer - 資料抓取腳本
# 注意：Trustpilot 評論為品牌級，非產品級

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="trustpilot"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
QUERIES_FILE="$SCRIPT_DIR/brand_queries.txt"

mkdir -p "$RAW_DIR"

echo "🏢 Trustpilot Layer: 開始抓取（品牌評價）"

# Trustpilot 需要 Playwright 爬蟲
cd "$PROJECT_ROOT/scrapers"

QUERY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --query) QUERY="$2"; shift 2 ;;
    *) echo "未知參數: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$QUERY" ]]; then
  echo "  📝 品牌: $QUERY"
  # 實際抓取由 Claude 透過 WebSearch + WebFetch 執行
  echo "  ⚠️ 請使用 WebSearch: site:trustpilot.com \"$QUERY\""
  echo "  然後 WebFetch 抓取品牌頁面"
  exit 0
fi

if [[ -f "$QUERIES_FILE" ]]; then
  QUERY_COUNT=$(grep -cvE '^\s*(#|$)' "$QUERIES_FILE" 2>/dev/null || echo "0")
  echo "  📋 共 $QUERY_COUNT 個品牌查詢"

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    echo "  🏢 $line"
    echo "    WebSearch: site:trustpilot.com \"$line\""
  done < "$QUERIES_FILE"
fi

echo "✅ Trustpilot 查詢計劃完成"
