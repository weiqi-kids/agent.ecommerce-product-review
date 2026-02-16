#!/usr/bin/env node
/**
 * SEO 驗證腳本
 * 檢查所有報告的 SEO frontmatter 和 AI Tags
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// 驗證規則定義
const RULES = {
  frontmatter: {
    required: ['title', 'description', 'date'],
    optional: ['head'],
    titleMaxLength: 60,
    descriptionMaxLength: 160,
    descriptionMinLength: 50,
  },
  aiTags: {
    required: ['article-summary'],
    recommended: ['key-answer', 'key-takeaway'],
    optional: ['comparison-table', 'actionable-steps'],
  },
  html: {
    // 檢查常見的 HTML 問題
    patterns: [
      { name: 'unclosed-div', regex: /<div[^>]*>(?![\s\S]*<\/div>)/g, message: '未關閉的 <div> 標籤' },
      { name: 'lt-symbol', regex: /< \d/g, message: '< 符號後接數字（會被解析為 HTML）' },
    ],
  },
};

// 解析 frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let inHead = false;

  for (const line of lines) {
    if (line.startsWith('head:')) {
      inHead = true;
      frontmatter.head = [];
      continue;
    }
    if (inHead && line.startsWith('  ')) {
      frontmatter.head.push(line);
      continue;
    }
    if (!line.startsWith('  ')) {
      inHead = false;
    }

    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      let value = keyMatch[2];
      // 移除引號
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      frontmatter[currentKey] = value;
    }
  }

  return frontmatter;
}

// 檢查 AI Tags
function checkAITags(content) {
  const tags = {};
  const tagPatterns = [
    { name: 'article-summary', pattern: /<div class="article-summary"[^>]*>/ },
    { name: 'key-answer', pattern: /<(?:p|div) class="key-answer"[^>]*/ },
    { name: 'key-takeaway', pattern: /<(?:p|div) class="key-takeaway"[^>]*>/ },
    { name: 'comparison-table', pattern: /<div class="comparison-table"[^>]*>/ },
    { name: 'actionable-steps', pattern: /<div class="actionable-steps"[^>]*>/ },
  ];

  for (const { name, pattern } of tagPatterns) {
    const matches = content.match(new RegExp(pattern, 'g'));
    tags[name] = matches ? matches.length : 0;
  }

  return tags;
}

// 檢查 HTML 問題
function checkHTMLIssues(content) {
  const issues = [];

  // 檢查 div 標籤是否配對
  const openDivs = (content.match(/<div[^>]*>/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  if (openDivs !== closeDivs) {
    issues.push({
      type: 'unclosed-div',
      message: `div 標籤未配對：開啟 ${openDivs} 個，關閉 ${closeDivs} 個`,
      severity: 'error',
    });
  }

  // 檢查 < 符號後接數字
  const ltMatches = content.match(/< \d/g);
  if (ltMatches) {
    issues.push({
      type: 'lt-symbol',
      message: `發現 ${ltMatches.length} 個 "< 數字" 模式，可能導致 HTML 解析錯誤`,
      severity: 'error',
    });
  }

  // 檢查 frontmatter 中是否有 HTML 標籤
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch && fmMatch[1].includes('</')) {
    issues.push({
      type: 'html-in-frontmatter',
      message: 'Frontmatter 中包含 HTML 標籤',
      severity: 'error',
    });
  }

  // 檢查 YAML 格式問題：title 或 description 含冒號但未加引號
  const titleMatch = content.match(/^title:\s*([^"\n][^:\n]*:[^\n]*)/m);
  if (titleMatch && !titleMatch[1].startsWith('"')) {
    issues.push({
      type: 'yaml-colon',
      message: 'title 含冒號但未加引號',
      severity: 'error',
    });
  }

  return issues;
}

// 驗證單個檔案
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const errors = [];
  const warnings = [];

  // 1. 檢查 frontmatter
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    errors.push({ field: 'frontmatter', message: '缺少 frontmatter' });
  } else {
    // 檢查必要欄位
    for (const field of RULES.frontmatter.required) {
      if (!frontmatter[field]) {
        errors.push({ field, message: `缺少必要欄位: ${field}` });
      }
    }

    // 檢查 title 長度
    if (frontmatter.title && frontmatter.title.length > RULES.frontmatter.titleMaxLength) {
      warnings.push({
        field: 'title',
        message: `title 過長 (${frontmatter.title.length}/${RULES.frontmatter.titleMaxLength})`,
      });
    }

    // 檢查 description 長度
    if (frontmatter.description) {
      if (frontmatter.description.length > RULES.frontmatter.descriptionMaxLength) {
        warnings.push({
          field: 'description',
          message: `description 過長 (${frontmatter.description.length}/${RULES.frontmatter.descriptionMaxLength})`,
        });
      }
      if (frontmatter.description.length < RULES.frontmatter.descriptionMinLength) {
        warnings.push({
          field: 'description',
          message: `description 過短 (${frontmatter.description.length}/${RULES.frontmatter.descriptionMinLength})`,
        });
      }
    }

    // 檢查 keywords
    if (!frontmatter.head || !frontmatter.head.some((h) => h.includes('keywords'))) {
      warnings.push({ field: 'keywords', message: '缺少 keywords meta tag' });
    }
  }

  // 2. 檢查 AI Tags
  const aiTags = checkAITags(content);
  for (const tag of RULES.aiTags.required) {
    if (!aiTags[tag]) {
      errors.push({ field: tag, message: `缺少必要 AI Tag: ${tag}` });
    }
  }
  for (const tag of RULES.aiTags.recommended) {
    if (!aiTags[tag]) {
      warnings.push({ field: tag, message: `建議添加 AI Tag: ${tag}` });
    }
  }

  // 3. 檢查 HTML 問題
  const htmlIssues = checkHTMLIssues(content);
  for (const issue of htmlIssues) {
    if (issue.severity === 'error') {
      errors.push({ field: issue.type, message: issue.message });
    } else {
      warnings.push({ field: issue.type, message: issue.message });
    }
  }

  return {
    file: relativePath,
    errors,
    warnings,
    aiTags,
    frontmatter,
  };
}

// 主程式
async function main() {
  const args = process.argv.slice(2);
  const outputFormat = args.includes('--json') ? 'json' : 'text';
  const fixMode = args.includes('--fix');

  // 找出所有報告檔案
  const files = await glob('docs/Narrator/**/*.md', { ignore: ['**/index.md'] });

  const results = {
    total: files.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    files: [],
  };

  for (const file of files) {
    const result = validateFile(file);
    results.files.push(result);

    if (result.errors.length > 0) {
      results.failed++;
    } else {
      results.passed++;
    }
    if (result.warnings.length > 0) {
      results.warnings++;
    }
  }

  // 輸出結果
  if (outputFormat === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n=== SEO 驗證報告 ===\n');
    console.log(`總檔案數: ${results.total}`);
    console.log(`通過: ${results.passed}`);
    console.log(`失敗: ${results.failed}`);
    console.log(`有警告: ${results.warnings}`);
    console.log('');

    // 顯示錯誤
    const failedFiles = results.files.filter((f) => f.errors.length > 0);
    if (failedFiles.length > 0) {
      console.log('❌ 錯誤:\n');
      for (const file of failedFiles) {
        console.log(`  ${file.file}:`);
        for (const error of file.errors) {
          console.log(`    - [${error.field}] ${error.message}`);
        }
      }
      console.log('');
    }

    // 顯示警告（僅顯示前 10 個）
    const warningFiles = results.files.filter((f) => f.warnings.length > 0);
    if (warningFiles.length > 0) {
      console.log('⚠️ 警告 (前 10 個):\n');
      let count = 0;
      for (const file of warningFiles) {
        if (count >= 10) break;
        console.log(`  ${file.file}:`);
        for (const warning of file.warnings) {
          console.log(`    - [${warning.field}] ${warning.message}`);
        }
        count++;
      }
      if (warningFiles.length > 10) {
        console.log(`\n  ... 還有 ${warningFiles.length - 10} 個檔案有警告`);
      }
    }
  }

  // 設定退出碼
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
