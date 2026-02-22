#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
LAYER_NAME="makeupalley"
DOCS_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME"
mkdir -p "$DOCS_DIR/beauty"
PROCESSED=0
for md_file in "$@"; do
  [[ ! -f "$md_file" ]] && continue
  PROCESSED=$((PROCESSED + 1))
done
echo "✅ Update completed: $LAYER_NAME"
