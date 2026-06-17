#!/bin/bash
# bestbuy_us 資料更新腳本
# 職責：Qdrant 更新 + REVIEW_NEEDED 檢查

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/lib/args.sh"
source "$PROJECT_ROOT/lib/core.sh"
source "$PROJECT_ROOT/lib/qdrant.sh"
source "$PROJECT_ROOT/lib/chatgpt.sh"

LAYER_NAME="bestbuy_us"
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
PROCESSED=0       # 實際處理的檔案數
UPSERTED=0        # 成功寫入 Qdrant 的數量
SKIP_NO_META=0    # 因缺 L1 metadata 表（無 Source URL）而跳過
SKIP_NO_EMBED=0   # 因 embedding 產生失敗而跳過
UPSERT_FAIL=0     # Qdrant upsert 呼叫失敗
SKIPPED_FILES=""  # 缺 metadata 的檔名清單
for md_file in "$@"; do
  if [[ ! -f "$md_file" ]]; then
    echo "⚠️  檔案不存在：$md_file" >&2
    continue
  fi

  echo "📝 處理：$(basename "$md_file")"

  # 從 .md 檔提取 metadata（表格格式：| **Field** | Value |）
  product_id=$(grep -m1 '\*\*product_id\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "")
  title=$(grep -m1 '^# ' "$md_file" 2>/dev/null | sed 's/^# //' || echo "")
  # 將 md_file 轉為絕對路徑後再剝離 DOCS_DIR 前綴
  abs_md_file="$(cd "$(dirname "$md_file")" && pwd)/$(basename "$md_file")"
  category=$(dirname "${abs_md_file#$DOCS_DIR/}")
  source_url=$(grep -m1 '\*\*Source URL\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "")
  avg_rating=$(grep -m1 '\*\*Avg Rating\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' | sed 's/ *(.*//' || echo "0")
  store_id=$(grep -m1 '\*\*Store\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' | sed 's/.*(\(.*\))/\1/' || echo "")
  review_count=$(grep -m1 '\*\*Reviews Analyzed\*\*' "$md_file" 2>/dev/null | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' || echo "0")

  # === fail-loud：缺 L1 metadata 表時不要靜默跳過 ===
  if [[ -n "${QDRANT_URL:-}" ]] && [[ -z "$source_url" ]]; then
    echo "  ⚠️  跳過向量化：缺 L1 metadata 表（無 **Source URL** 欄位）→ $(basename "$md_file")" >&2
    SKIP_NO_META=$((SKIP_NO_META + 1))
    SKIPPED_FILES+="    - $(basename "$md_file")\n"
  fi

  # Qdrant upsert（若環境就緒）
  if [[ -n "${QDRANT_URL:-}" ]] && [[ -n "$source_url" ]]; then
    echo "  📤 Qdrant upsert: $source_url"
    # 使用 source_url 作為 point ID 的基礎
    local_id="$(_qdrant_id_to_uuid "$source_url")"

    # 產生 embedding
    if command -v chatgpt_embed >/dev/null 2>&1; then
      embedding=$(chatgpt_embed "$title" 2>/dev/null || echo "")
    fi

    # 組合 payload
    rel_path="${abs_md_file#$PROJECT_ROOT/}"
    payload=$(jq -n \
      --arg source_url "$source_url" \
      --arg fetched_at "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      --arg file_path "$rel_path" \
      --arg product_id "$product_id" \
      --arg platform "$LAYER_NAME" \
      --arg store_id "$store_id" \
      --arg title "$title" \
      --arg category "$category" \
      --arg avg_rating "$avg_rating" \
      --arg review_count "$review_count" \
      '{
        source_url: $source_url,
        fetched_at: $fetched_at,
        file_path: $file_path,
        product_id: $product_id,
        platform: $platform,
        store_id: $store_id,
        title: $title,
        category: $category,
        avg_rating: $avg_rating,
        review_count: $review_count
      }'
    )

    if [[ -n "${embedding:-}" ]]; then
      if qdrant_upsert_point "${QDRANT_COLLECTION:-product-reviews}" "$local_id" "$embedding" "$payload" 2>/dev/null; then
        UPSERTED=$((UPSERTED + 1))
      else
        echo "  ⚠️  Qdrant upsert 失敗：$(basename "$md_file")" >&2
        UPSERT_FAIL=$((UPSERT_FAIL + 1))
      fi
    else
      echo "  ⚠️  跳過向量化：embedding 產生失敗（檢查 OpenAI 金鑰）→ $(basename "$md_file")" >&2
      SKIP_NO_EMBED=$((SKIP_NO_EMBED + 1))
    fi
  fi

  PROCESSED=$((PROCESSED + 1))
done

# === fail-loud 向量化結果斷言 ===
echo ""
echo "📊 向量化結果：已處理 $PROCESSED 檔 | 成功 upsert $UPSERTED | 缺 metadata 跳過 $SKIP_NO_META | embedding 失敗 $SKIP_NO_EMBED | upsert 失敗 $UPSERT_FAIL"
if [[ -n "${QDRANT_URL:-}" ]] && [[ "$UPSERTED" -lt "$PROCESSED" ]]; then
  echo "⚠️  警告：向量化數（$UPSERTED）少於處理數（$PROCESSED）——有檔案未寫入 Qdrant！" >&2
  if [[ "$SKIP_NO_META" -gt 0 ]]; then
    echo "   以下檔案缺 L1 metadata 表（**Source URL**/**product_id** 等），請確認萃取遵循 core/Extractor/CLAUDE.md L1 模板：" >&2
    echo -e "$SKIPPED_FILES" >&2
  fi
fi

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
  # 嘗試建立 GitHub Issue
  command -v gh >/dev/null 2>&1 && gh issue create \
    --title "[Extractor] $LAYER_NAME - 需要人工審核" \
    --label "review-needed" \
    --body "偵測到 [REVIEW_NEEDED] 標記" 2>/dev/null || true
fi

echo "✅ Update completed: $LAYER_NAME"
