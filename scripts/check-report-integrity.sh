#!/bin/bash
# 報告完整性檢查
# 檢查：1) 所有報告已索引 2) 無模板佔位符 3) 無跨目錄失效連結

DOCS_DIR="docs/Narrator"
EXIT_CODE=0

echo "=== 報告完整性檢查 ==="
echo ""

# 1. 檢查所有報告是否已索引到 index.md
echo "--- 1. index.md 同步檢查 ---"
MISSING_COUNT=0

for dir in comparisons warnings recommendations pain_points counterfeits; do
  INDEX_FILE="$DOCS_DIR/$dir/index.md"
  if [ ! -f "$INDEX_FILE" ]; then
    continue
  fi

  for report in "$DOCS_DIR/$dir"/*.md; do
    basename=$(basename "$report" .md)
    if [ "$basename" = "index" ]; then
      continue
    fi
    # 檢查 index.md 是否包含此報告的連結
    if ! grep -q "$basename" "$INDEX_FILE"; then
      echo "  ❌ 未索引: $dir/$basename.md"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
  done
done

if [ $MISSING_COUNT -eq 0 ]; then
  echo "  ✅ 所有報告已正確索引"
else
  echo "  共 $MISSING_COUNT 份報告未索引"
  EXIT_CODE=1
fi

echo ""

# 2. 檢查模板佔位符
echo "--- 2. 模板佔位符掃描 ---"
PLACEHOLDER_COUNT=0

# 檢查 {WebSearch 來源}、{TODO}、{待補} 等常見佔位符
for pattern in '{WebSearch' '{TODO' '{待補' '{來源}' '{連結}'; do
  results=$(grep -r "$pattern" "$DOCS_DIR" --include="*.md" -l 2>/dev/null)
  if [ -n "$results" ]; then
    for file in $results; do
      echo "  ❌ 佔位符 '$pattern': $file"
      PLACEHOLDER_COUNT=$((PLACEHOLDER_COUNT + 1))
    done
  fi
done

if [ $PLACEHOLDER_COUNT -eq 0 ]; then
  echo "  ✅ 無模板佔位符"
else
  EXIT_CODE=1
fi

echo ""

# 3. 檢查跨目錄 markdown 連結（../Extractor/ 連結在 VitePress 會 404）
echo "--- 3. 跨目錄連結檢查 ---"
CROSSLINK_COUNT=0

results=$(grep -rn '\[.*\](.*\.\./Extractor/.*)' "$DOCS_DIR" --include="*.md" 2>/dev/null)
if [ -n "$results" ]; then
  echo "$results" | while read -r line; do
    echo "  ❌ 跨目錄連結: $line"
  done
  CROSSLINK_COUNT=$(echo "$results" | wc -l | tr -d ' ')
  EXIT_CODE=1
else
  echo "  ✅ 無跨目錄失效連結"
fi

echo ""
echo "=== 檢查結果 ==="
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 全部通過"
else
  echo "❌ 有問題需修復"
fi

exit $EXIT_CODE
