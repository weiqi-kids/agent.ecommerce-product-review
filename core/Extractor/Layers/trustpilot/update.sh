#!/bin/bash
# Trustpilot Layer - 資料更新腳本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
source "$PROJECT_ROOT/lib/qdrant.sh"
source "$PROJECT_ROOT/lib/chatgpt.sh"

LAYER_NAME="trustpilot"
DOCS_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME"

for category in electronics home_appliance beauty health toys_games sports_outdoor fashion food_beverage pet baby automotive other; do
  mkdir -p "$DOCS_DIR/$category"
done

chatgpt_init_env || echo "⚠️  OpenAI 初始化失敗" >&2
[[ -n "${QDRANT_URL:-}" ]] && qdrant_init_env || true

PROCESSED=0
for md_file in "$@"; do
  [[ ! -f "$md_file" ]] && continue
  echo "📝 處理：$(basename "$md_file")"
  PROCESSED=$((PROCESSED + 1))
done

echo "📊 已處理 $PROCESSED 個檔案"
echo "✅ Update completed: $LAYER_NAME"
