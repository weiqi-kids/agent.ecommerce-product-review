#!/usr/bin/env node
/**
 * 萃取格式驗證器
 *
 * 確認萃取 .md 含 update.sh 向量化所需的 L1 英文 metadata 表欄位。
 * 缺欄位會導致 update.sh 的 Qdrant upsert 靜默跳過（2026-06-17 曾踩此坑）。
 *
 * 用法：
 *   node scripts/validate-extraction.js                  # 驗證今日所有平台萃取檔
 *   node scripts/validate-extraction.js --date 2026-06-17
 *   node scripts/validate-extraction.js path/to/file.md ...   # 驗證指定檔案
 *
 * 退出碼：有檔案缺必要欄位時為 1（可用於 CI / Step 6 Reviewer 閘門）。
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// update.sh 透過 grep 擷取、且為 Qdrant upsert 前提的欄位
const REQUIRED_FIELDS = [
  'product_id',
  'Source URL',
  'Avg Rating',
  'Store',
  'Reviews Analyzed',
];

function todayISO() {
  // 不依賴系統時鐘以外的格式；取 YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

function collectFiles(args) {
  const explicit = args.filter((a) => a.endsWith('.md'));
  if (explicit.length) return explicit;

  const dateIdx = args.indexOf('--date');
  const date = dateIdx >= 0 ? args[dateIdx + 1] : todayISO();
  // 掃所有平台的萃取目錄，找當日檔案
  let files = [];
  try {
    const out = execSync(
      `find docs/Extractor -type f -name "*--${date}.md" -not -path "*/raw/*" -not -name "index.md"`,
      { encoding: 'utf8' }
    );
    files = out.split('\n').filter(Boolean);
  } catch (e) {
    /* find 無結果時回空 */
  }
  // 只保留真正的萃取檔（含 L1 區段）；排除 research/competitors/報告等同日檔
  return files.filter((f) => {
    try {
      return /^##\s*L1/m.test(fs.readFileSync(f, 'utf8'));
    } catch {
      return false;
    }
  });
}

function validate(file) {
  const content = fs.readFileSync(file, 'utf8');
  const missing = REQUIRED_FIELDS.filter(
    (f) => !content.includes(`**${f}**`)
  );
  return missing;
}

function main() {
  const args = process.argv.slice(2);
  const files = collectFiles(args);

  if (!files.length) {
    console.log('ℹ️  沒有找到要驗證的萃取檔（指定檔案或 --date）。');
    process.exit(0);
  }

  console.log(`\n=== 萃取格式驗證（${files.length} 檔）===\n`);
  let failed = 0;
  for (const f of files) {
    const missing = validate(f);
    if (missing.length) {
      failed++;
      console.log(`❌ ${path.basename(f)}`);
      console.log(`   缺少 L1 欄位: ${missing.map((m) => `**${m}**`).join(', ')}`);
    }
  }

  console.log('');
  console.log(`通過: ${files.length - failed} / ${files.length}`);
  if (failed) {
    console.log(`\n⚠️  ${failed} 個萃取檔缺 update.sh 需要的 L1 metadata 表欄位。`);
    console.log('   這會導致 Qdrant 向量化被靜默跳過。');
    console.log('   修正：萃取須遵循 core/Extractor/CLAUDE.md 的 L1 表格模板（含 **product_id** / **Source URL** / **Avg Rating** / **Store** / **Reviews Analyzed**）。');
    process.exit(1);
  }
  console.log('✅ 全部萃取檔含必要 L1 metadata 欄位，可安全向量化。');
}

main();
