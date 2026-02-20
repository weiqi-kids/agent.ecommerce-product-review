#!/usr/bin/env node
/**
 * 批次為報告新增 ReportSummary 所需的 frontmatter
 *
 * 使用方式：
 *   node scripts/add-report-frontmatter.js
 *   node scripts/add-report-frontmatter.js --dry-run  # 只顯示不寫入
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const DRY_RUN = process.argv.includes('--dry-run');

// 根據路徑判斷 verdict
function getVerdict(filePath) {
  if (filePath.includes('/warnings/')) return 'warning';
  if (filePath.includes('/counterfeits/')) return 'warning';
  if (filePath.includes('/pain_points/')) return 'caution';
  if (filePath.includes('/recommendations/')) return 'recommend';
  if (filePath.includes('/comparisons/')) return 'neutral';
  return 'neutral';
}

// 從內容提取評論數
function extractReviewCount(content) {
  // 常見模式
  const patterns = [
    /(\d+)\s*則評論/,
    /(\d+)\s*則.*評論/,
    /(\d+)\s*reviews?/i,
    /分析.*?(\d+)\s*則/,
    /資料來源.*?(\d+)\s*則/,
    /Amazon.*?(\d+)\s*則/,
    /基於\s*(\d+)\s*則/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

// 從內容提取負評率或問題率
function extractNegativeRate(content, verdict) {
  // 警告報告：找問題發生率
  if (verdict === 'warning') {
    const patterns = [
      /(\d+)%.*?(?:火災|故障|失效|斷裂|問題|風險)/,
      /(?:火災|故障|失效|斷裂|問題|風險).*?(\d+)%/,
      /負評率.*?(\d+)%/,
      /(\d+)%\s*負評/,
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }

  // 推薦報告：找有效率的反面
  if (verdict === 'recommend') {
    const patterns = [
      /(\d+)%\s*有效/,
      /有效.*?(\d+)%/,
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const effectiveness = parseInt(match[1], 10);
        return 100 - effectiveness; // 有效率的反面
      }
    }
  }

  return null;
}

// 從內容提取關鍵問題
function extractIssues(content, verdict) {
  const issues = [];

  if (verdict === 'warning' || verdict === 'caution') {
    // 找表格中的問題
    const tablePattern = /\|\s*[🔥⚡🔊❌⚠️📦]?\s*([^|]+?)\s*\|\s*\**(\d+%?)\**\s*\|/g;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      const issue = match[1].trim();
      const rate = match[2].trim();
      if (issue && rate && !issue.includes('---') && !issue.includes('風險類型')) {
        issues.push(`${rate} ${issue}`);
      }
      if (issues.length >= 3) break;
    }

    // 如果沒找到，找 bullet points
    if (issues.length === 0) {
      const bulletPattern = /[-•]\s*(\d+%[^,\n]+)/g;
      while ((match = bulletPattern.exec(content)) !== null) {
        issues.push(match[1].trim());
        if (issues.length >= 3) break;
      }
    }
  }

  if (verdict === 'recommend') {
    // 找正面特點
    const patterns = [
      /(\d+%\s*有效[^,\n]*)/g,
      /(皮膚科醫師[^,\n]*)/g,
      /(唯一[^,\n]*)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push(match[1].trim());
        if (issues.length >= 3) break;
      }
      if (issues.length >= 3) break;
    }
  }

  return issues.slice(0, 3);
}

// 檢查是否已有新 frontmatter
function hasNewFrontmatter(content) {
  return content.includes('verdict:') || content.includes('reviewCount:');
}

// 處理單個檔案
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 跳過 index.md
  if (filePath.endsWith('index.md')) {
    return { skipped: true, reason: 'index file' };
  }

  // 跳過已處理的檔案
  if (hasNewFrontmatter(content)) {
    return { skipped: true, reason: 'already has frontmatter' };
  }

  // 檢查是否有 frontmatter
  if (!content.startsWith('---')) {
    return { skipped: true, reason: 'no frontmatter' };
  }

  const verdict = getVerdict(filePath);
  const reviewCount = extractReviewCount(content);
  const negativeRate = extractNegativeRate(content, verdict);
  const issues = extractIssues(content, verdict);

  // 構建新的 frontmatter 欄位
  const newFields = [];
  newFields.push(`verdict: ${verdict}`);
  if (reviewCount) newFields.push(`reviewCount: ${reviewCount}`);
  if (negativeRate) newFields.push(`negativeRate: ${negativeRate}`);
  if (issues.length > 0) {
    newFields.push('issues:');
    issues.forEach(issue => {
      newFields.push(`  - ${issue}`);
    });
  }

  // 在 frontmatter 結尾前插入新欄位
  const frontmatterEnd = content.indexOf('---', 4);
  if (frontmatterEnd === -1) {
    return { skipped: true, reason: 'malformed frontmatter' };
  }

  const newContent =
    content.slice(0, frontmatterEnd) +
    newFields.join('\n') + '\n' +
    content.slice(frontmatterEnd);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return {
    updated: true,
    verdict,
    reviewCount,
    negativeRate,
    issues
  };
}

// 主程式
function main() {
  const files = globSync('docs/Narrator/**/*.md');

  console.log(`找到 ${files.length} 個檔案`);
  if (DRY_RUN) {
    console.log('🔍 Dry run 模式 - 不會寫入檔案\n');
  }

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const result = processFile(file);

    if (result.skipped) {
      skipped++;
      if (DRY_RUN) {
        console.log(`⏭️  ${file} - ${result.reason}`);
      }
    } else if (result.updated) {
      updated++;
      console.log(`✅ ${file}`);
      console.log(`   verdict: ${result.verdict}, reviews: ${result.reviewCount || 'N/A'}, negRate: ${result.negativeRate || 'N/A'}`);
      if (result.issues.length > 0) {
        console.log(`   issues: ${result.issues.join('; ')}`);
      }
    }
  }

  console.log(`\n完成：${updated} 個更新，${skipped} 個跳過`);
}

main();
