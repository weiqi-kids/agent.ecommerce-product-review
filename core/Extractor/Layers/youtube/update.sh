#!/bin/bash
# YouTube Layer - 資料更新腳本
# 職責：Qdrant 更新 + REVIEW_NEEDED 檢查

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
source "$PROJECT_ROOT/lib/qdrant.sh"
source "$PROJECT_ROOT/lib/chatgpt.sh"

LAYER_NAME="youtube"
DOCS_DIR="$PROJECT_ROOT/docs/Extractor/$LAYER_NAME"

# 確保分類子目錄存在
for category in electronics home_appliance beauty health toys_games sports_outdoor fashion food_beverage pet baby automotive other; do
  mkdir -p "$DOCS_DIR/$category"
done

# === 初始化外部服務 ===
chatgpt_init_env || echo "⚠️  OpenAI 初始化失敗，跳過 embedding" >&2
if [[ -n "${QDRANT_URL:-}" ]]; then
  qdrant_init_env || echo "⚠️  Qdrant 連線失敗，跳過向量寫入" >&2
fi

# === 處理傳入的 .md 檔案 ===
PROCESSED=0
for md_file in "$@"; do
  if [[ ! -f "$md_file" ]]; then
    echo "⚠️  檔案不存在：$md_file" >&2
    continue
  fi

  echo "📝 處理：$(basename "$md_file")"

  # 從 .md 檔提取 metadata
  search_query=$(grep -m1 '\*\*search_query\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "")
  title=$(grep -m1 '^# ' "$md_file" 2>/dev/null | sed 's/^# //' || echo "")

  # 將 md_file 轉為絕對路徑後再剝離 DOCS_DIR 前綴
  abs_md_file="$(cd "$(dirname "$md_file")" && pwd)/$(basename "$md_file")"
  category=$(dirname "${abs_md_file#$DOCS_DIR/}")

  videos_analyzed=$(grep -m1 '\*\*videos_analyzed\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "0")
  total_comments=$(grep -m1 '\*\*total_comments\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "0")
  matched_asin=$(grep -m1 '\*\*matched_asin\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "")

  # Qdrant upsert（若環境就緒）
  if [[ -n "${QDRANT_URL:-}" ]] && [[ -n "$search_query" ]]; then
    echo "  📤 Qdrant upsert: $search_query"

    # 使用 search_query + platform 作為 point ID
    local_id="$(_qdrant_id_to_uuid "youtube:$search_query")"

    # 產生 embedding
    if command -v chatgpt_embed >/dev/null 2>&1; then
      embedding=$(chatgpt_embed "$title" 2>/dev/null || echo "")
    fi

    # 組合 payload
    rel_path="${abs_md_file#$PROJECT_ROOT/}"
    payload=$(jq -n \
      --arg search_query "$search_query" \
      --arg fetched_at "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      --arg file_path "$rel_path" \
      --arg platform "$LAYER_NAME" \
      --arg source_type "social" \
      --arg title "$title" \
      --arg category "$category" \
      --arg videos_analyzed "$videos_analyzed" \
      --arg total_comments "$total_comments" \
      --arg matched_asin "$matched_asin" \
      '{
        search_query: $search_query,
        fetched_at: $fetched_at,
        file_path: $file_path,
        platform: $platform,
        source_type: $source_type,
        title: $title,
        category: $category,
        videos_analyzed: $videos_analyzed,
        total_comments: $total_comments,
        matched_asin: $matched_asin
      }'
    )

    if [[ -n "${embedding:-}" ]]; then
      qdrant_upsert_point "${QDRANT_COLLECTION:-product-reviews}" "$local_id" "$embedding" "$payload" 2>/dev/null || \
        echo "  ⚠️  Qdrant upsert 失敗" >&2
    fi
  fi

  PROCESSED=$((PROCESSED + 1))
done

echo "📊 已處理 $PROCESSED 個檔案"

# === REVIEW_NEEDED 檢查 ===
REVIEW_FILES=""
while IFS= read -r f; do
  if grep -q "\[REVIEW_NEEDED\]" "$f" 2>/dev/null; then
    REVIEW_FILES+="  - $f\n"
  fi
done < <(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null)

if [[ -n "$REVIEW_FILES" ]]; then
  echo ""
  echo "⚠️  需要審核："
  echo -e "$REVIEW_FILES"
fi

echo "✅ Update completed: $LAYER_NAME"
