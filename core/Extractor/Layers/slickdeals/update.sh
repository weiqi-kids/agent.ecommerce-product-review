#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
LAYER_NAME="slickdeals"
DOCS_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME"
for cat in electronics home_appliance beauty health toys_games other; do mkdir -p "$DOCS_DIR/$cat"; done
PROCESSED=0
for md_file in "$@"; do
  [[ ! -f "$md_file" ]] && continue
  PROCESSED=$((PROCESSED + 1))
done
echo "✅ Update completed: $LAYER_NAME"
