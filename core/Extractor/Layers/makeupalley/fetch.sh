#!/bin/bash
# MakeupAlley Layer - 資料抓取腳本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"

LAYER_NAME="makeupalley"
RAW_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME/raw"
QUERIES_FILE="$SCRIPT_DIR/product_queries.txt"

mkdir -p "$RAW_DIR"

echo "💄 MakeupAlley Layer: 開始抓取（美妝論壇）"

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
  npx tsx src/forum-common/scraper.ts --forum makeupalley --query "$QUERY" --output "$RAW_DIR" || {
    echo "  ⚠️ 抓取失敗: $QUERY"
  }
  exit 0
fi

if [[ -f "$QUERIES_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    echo "  💄 $line"
  done < "$QUERIES_FILE"
fi

echo "✅ MakeupAlley 抓取完成"
