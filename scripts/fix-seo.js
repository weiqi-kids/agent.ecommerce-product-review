#!/usr/bin/env node
/**
 * SEO 自動修復腳本
 * 嘗試自動修復常見的 SEO 問題
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// 修復規則
const FIXES = {
  // 修復 < 數字 → 小於 數字
  ltSymbol: {
    pattern: /< (\d)/g,
    replacement: '小於 $1',
    description: '將 "< 數字" 替換為 "小於 數字"',
  },

  // 修復 frontmatter 中的 HTML 標籤
  htmlInFrontmatter: {
    check: (content) => {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      return fmMatch && fmMatch[1].includes('</div>');
    },
    fix: (content) => {
      // 移除 frontmatter 中的 </div>
      return content.replace(/^(---\n[\s\S]*?)<\/div>\n*(---)/m, '$1$2');
    },
    description: '移除 frontmatter 中的 HTML 標籤',
  },

  // 修復未加引號的 title（含冒號）
  yamlColon: {
    check: (content) => {
      const match = content.match(/^title:\s*([^"\n][^:\n]*:[^\n]*)/m);
      return match && !match[1].startsWith('"');
    },
    fix: (content) => {
      return content.replace(/^(title:\s*)([^"\n][^:\n]*:[^\n]*)/m, '$1"$2"');
    },
    description: '為含冒號的 title 加上引號',
  },
};

// 計算未關閉的 div 數量
function countUnclosedDivs(content) {
  const openDivs = (content.match(/<div[^>]*>/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  return openDivs - closeDivs;
}

// 嘗試修復未關閉的 div
function fixUnclosedDivs(content, filePath) {
  const unclosed = countUnclosedDivs(content);
  if (unclosed <= 0) return { content, fixed: false };

  // 找出所有 div 的開啟位置
  const divClasses = ['article-summary', 'key-answer', 'key-takeaway', 'comparison-table', 'actionable-steps'];

  for (const className of divClasses) {
    const openPattern = new RegExp(`<div class="${className}">`, 'g');
    const openMatches = [...content.matchAll(openPattern)];

    for (const match of openMatches) {
      const startPos = match.index + match[0].length;
      const afterOpen = content.slice(startPos);

      // 找到下一個段落分隔（--- 或 ##）
      const nextSection = afterOpen.match(/\n(---|##)/);
      if (nextSection) {
        const endPos = startPos + nextSection.index;

        // 檢查這個區塊是否有對應的 </div>
        const block = content.slice(match.index, endPos);
        const blockOpens = (block.match(/<div/g) || []).length;
        const blockCloses = (block.match(/<\/div>/g) || []).length;

        if (blockOpens > blockCloses) {
          // 需要在 nextSection 前插入 </div>
          const insertPos = endPos;
          content = content.slice(0, insertPos) + '\n</div>\n' + content.slice(insertPos);
          console.log(`  修復: 在 ${className} 區塊後插入 </div>`);
        }
      }
    }
  }

  const newUnclosed = countUnclosedDivs(content);
  return {
    content,
    fixed: newUnclosed < unclosed,
    remaining: newUnclosed,
  };
}

// 生成基本 frontmatter
function generateFrontmatter(content, filePath) {
  const fileName = path.basename(filePath, '.md');
  const parts = fileName.split('--');
  const problemName = parts[0].replace(/-/g, ' ');
  const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || new Date().toISOString().split('T')[0];

  // 從內容提取標題
  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1] : problemName;

  // 從內容提取摘要
  const summaryMatch = content.match(/<div class="article-summary">\s*([\s\S]*?)\s*<\/div>/);
  let description = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').slice(0, 155) : `${problemName} 產品比較指南`;

  // 生成關鍵字
  const keywords = problemName.split(' ').filter((w) => w.length > 1).join(', ');

  return `---
title: ${title.includes(':') ? `"${title}"` : title}
description: ${description}
date: ${date}
head:
  - - meta
    - name: keywords
      content: ${keywords}
---

`;
}

// 生成基本 article-summary
function generateArticleSummary(content) {
  // 嘗試從第一段提取摘要
  const firstPara = content.match(/^(?!#|<|---|```|\|)(.{50,300})/m);
  if (firstPara) {
    return `<div class="article-summary">
${firstPara[1].trim()}
</div>

`;
  }
  return '';
}

// 修復單個檔案
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const fixes = [];

  // 1. 修復 < 數字
  if (FIXES.ltSymbol.pattern.test(content)) {
    content = content.replace(FIXES.ltSymbol.pattern, FIXES.ltSymbol.replacement);
    fixes.push(FIXES.ltSymbol.description);
  }

  // 2. 修復 frontmatter 中的 HTML
  if (FIXES.htmlInFrontmatter.check(content)) {
    content = FIXES.htmlInFrontmatter.fix(content);
    fixes.push(FIXES.htmlInFrontmatter.description);
  }

  // 3. 修復 YAML 冒號
  if (FIXES.yamlColon.check(content)) {
    content = FIXES.yamlColon.fix(content);
    fixes.push(FIXES.yamlColon.description);
  }

  // 4. 修復未關閉的 div
  const divResult = fixUnclosedDivs(content, filePath);
  if (divResult.fixed) {
    content = divResult.content;
    fixes.push(`修復未關閉的 div（剩餘 ${divResult.remaining} 個需手動處理）`);
  }

  // 5. 如果缺少 frontmatter，嘗試生成
  if (!content.match(/^---\n/)) {
    const frontmatter = generateFrontmatter(content, filePath);
    content = frontmatter + content;
    fixes.push('生成基本 frontmatter');
  }

  // 6. 如果缺少 article-summary，嘗試生成
  if (!content.includes('class="article-summary"')) {
    const h1Match = content.match(/^(#\s+.+\n)/m);
    if (h1Match) {
      const summary = generateArticleSummary(content);
      if (summary) {
        content = content.replace(h1Match[0], h1Match[0] + '\n' + summary);
        fixes.push('生成基本 article-summary');
      }
    }
  }

  // 寫入修復後的內容
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { fixed: true, fixes };
  }

  return { fixed: false, fixes: [] };
}

// 主程式
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const specificFiles = args.filter((a) => !a.startsWith('--'));

  // 找出需要修復的檔案
  let files;
  if (specificFiles.length > 0) {
    files = specificFiles;
  } else {
    files = await glob('docs/Narrator/**/*.md', { ignore: ['**/index.md'] });
  }

  console.log('\n=== SEO 自動修復 ===\n');
  console.log(`模式: ${dryRun ? '預覽（不實際修改）' : '修復'}`);
  console.log(`檔案數: ${files.length}\n`);

  const results = {
    total: files.length,
    fixed: 0,
    unchanged: 0,
    fixes: [],
  };

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);

    if (dryRun) {
      // 預覽模式：只檢查不修復
      const content = fs.readFileSync(file, 'utf-8');
      const issues = [];

      if (FIXES.ltSymbol.pattern.test(content)) issues.push(FIXES.ltSymbol.description);
      if (FIXES.htmlInFrontmatter.check(content)) issues.push(FIXES.htmlInFrontmatter.description);
      if (FIXES.yamlColon.check(content)) issues.push(FIXES.yamlColon.description);
      if (countUnclosedDivs(content) > 0) issues.push(`${countUnclosedDivs(content)} 個未關閉的 div`);

      if (issues.length > 0) {
        console.log(`📝 ${relativePath}:`);
        issues.forEach((i) => console.log(`   - ${i}`));
        results.fixed++;
      }
    } else {
      // 實際修復
      const result = fixFile(file);
      if (result.fixed) {
        console.log(`✅ ${relativePath}:`);
        result.fixes.forEach((f) => console.log(`   - ${f}`));
        results.fixed++;
        results.fixes.push({ file: relativePath, fixes: result.fixes });
      } else {
        results.unchanged++;
      }
    }
  }

  console.log('\n--- 摘要 ---');
  console.log(`修復: ${results.fixed} 檔案`);
  console.log(`無需修改: ${results.unchanged} 檔案`);

  // 輸出 JSON 結果（供 GitHub Action 使用）
  if (args.includes('--json')) {
    console.log('\n--- JSON 輸出 ---');
    console.log(JSON.stringify(results, null, 2));
  }

  return results;
}

main().catch(console.error);
