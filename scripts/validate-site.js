#!/usr/bin/env node
/**
 * 全站 SEO 驗證腳本
 * 爬取已部署的網站，驗證每個頁面的 SEO 元素
 */

import fs from 'fs';

// 設定
const CONFIG = {
  siteUrl: process.env.SITE_URL || 'https://weiqi-kids.github.io/agent.ecommerce-product-review',
  sitemapPath: '/sitemap.xml',
  timeout: 30000,
  concurrency: 5,
  // 只驗證報告頁面
  includePatterns: ['/Narrator/'],
  excludePatterns: ['/index.html', '/about', '/404'],
};

// SEO 驗證規則
const SEO_RULES = {
  meta: {
    // 網站會自動添加 " | 買前必看" (8字元)，所以實際顯示會是 title + 8
    title: { required: true, maxLength: 60 },
    description: { required: true, minLength: 50, maxLength: 160 },
    keywords: { required: false },
    'og:title': { required: true },
    'og:description': { required: true },
    'og:type': { required: true },
    'twitter:card': { required: true },
  },
  jsonLd: {
    requiredTypes: ['Article', 'WebSite', 'Organization'],
    requiredFields: {
      Article: ['headline', 'description', 'datePublished', 'author'],
    },
  },
  aiTags: {
    required: ['article-summary'],
    recommended: ['key-answer', 'key-takeaway'],
  },
};

// 從 sitemap 獲取所有 URL
async function getUrlsFromSitemap(siteUrl) {
  const sitemapUrl = `${siteUrl}${CONFIG.sitemapPath}`;
  console.log(`📍 讀取 sitemap: ${sitemapUrl}`);

  try {
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();

    // 簡單解析 XML 中的 <loc> 標籤
    const urls = [];
    const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    for (const match of locMatches) {
      const url = match[1];
      // 過濾
      const shouldInclude = CONFIG.includePatterns.some((p) => url.includes(p));
      const shouldExclude = CONFIG.excludePatterns.some((p) => url.includes(p));
      if (shouldInclude && !shouldExclude) {
        urls.push(url);
      }
    }

    console.log(`   找到 ${urls.length} 個報告頁面\n`);
    return urls;
  } catch (error) {
    console.error(`❌ 無法讀取 sitemap: ${error.message}`);
    return [];
  }
}

// 驗證單個頁面
async function validatePage(url) {
  const errors = [];
  const warnings = [];
  const info = {};

  try {
    const response = await fetch(url, { timeout: CONFIG.timeout });
    if (!response.ok) {
      return { url, errors: [{ type: 'http', message: `HTTP ${response.status}` }], warnings, info };
    }

    const html = await response.text();

    // 1. 驗證 <title>
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    if (!titleMatch) {
      errors.push({ type: 'meta', field: 'title', message: '缺少 <title> 標籤' });
    } else {
      info.title = titleMatch[1];
      if (titleMatch[1].length > SEO_RULES.meta.title.maxLength) {
        warnings.push({ type: 'meta', field: 'title', message: `title 過長 (${titleMatch[1].length}/${SEO_RULES.meta.title.maxLength})` });
      }
    }

    // 2. 驗證 meta tags
    const metaTags = {
      description: html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1],
      keywords: html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/)?.[1],
      'og:title': html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1],
      'og:description': html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)?.[1],
      'og:type': html.match(/<meta\s+property="og:type"\s+content="([^"]*)"/)?.[1],
      'twitter:card': html.match(/<meta\s+name="twitter:card"\s+content="([^"]*)"/)?.[1],
    };

    for (const [tag, rule] of Object.entries(SEO_RULES.meta)) {
      if (tag === 'title') continue; // 已檢查
      const value = metaTags[tag];

      if (rule.required && !value) {
        errors.push({ type: 'meta', field: tag, message: `缺少 <meta ${tag}>` });
      } else if (value) {
        info[tag] = value.slice(0, 50) + (value.length > 50 ? '...' : '');

        if (rule.minLength && value.length < rule.minLength) {
          warnings.push({ type: 'meta', field: tag, message: `${tag} 過短 (${value.length}/${rule.minLength})` });
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          warnings.push({ type: 'meta', field: tag, message: `${tag} 過長 (${value.length}/${rule.maxLength})` });
        }
      }
    }

    // 3. 驗證 JSON-LD
    const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json">([^<]+)<\/script>/g);
    const jsonLdTypes = [];

    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        // 處理 @graph 格式
        const items = data['@graph'] || [data];
        for (const item of items) {
          if (item['@type']) {
            jsonLdTypes.push(item['@type']);
          }
        }
      } catch (e) {
        errors.push({ type: 'jsonld', message: 'JSON-LD 解析失敗' });
      }
    }

    info.jsonLdTypes = jsonLdTypes.join(', ');

    for (const requiredType of SEO_RULES.jsonLd.requiredTypes) {
      if (!jsonLdTypes.includes(requiredType)) {
        warnings.push({ type: 'jsonld', message: `缺少 JSON-LD @type: ${requiredType}` });
      }
    }

    // 4. 驗證 AI Tags
    const aiTags = {
      'article-summary': /<(?:div|section)[^>]*class="[^"]*article-summary[^"]*"/.test(html),
      'key-answer': /<(?:p|div)[^>]*class="[^"]*key-answer[^"]*"/.test(html),
      'key-takeaway': /<(?:p|div)[^>]*class="[^"]*key-takeaway[^"]*"/.test(html),
      'comparison-table': /<div[^>]*class="[^"]*comparison-table[^"]*"/.test(html),
      'actionable-steps': /<div[^>]*class="[^"]*actionable-steps[^"]*"/.test(html),
    };

    info.aiTags = Object.entries(aiTags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');

    for (const tag of SEO_RULES.aiTags.required) {
      if (!aiTags[tag]) {
        errors.push({ type: 'aitag', field: tag, message: `缺少必要 AI Tag: ${tag}` });
      }
    }

    for (const tag of SEO_RULES.aiTags.recommended) {
      if (!aiTags[tag]) {
        warnings.push({ type: 'aitag', field: tag, message: `建議添加 AI Tag: ${tag}` });
      }
    }

    // 5. 檢查其他 SEO 元素
    if (!html.includes('lang="zh-TW"') && !html.includes("lang='zh-TW'")) {
      warnings.push({ type: 'html', message: '缺少 lang="zh-TW" 屬性' });
    }

    if (!/<link[^>]*rel="canonical"/.test(html)) {
      warnings.push({ type: 'html', message: '缺少 canonical link' });
    }

    return { url, errors, warnings, info };
  } catch (error) {
    return { url, errors: [{ type: 'fetch', message: error.message }], warnings, info };
  }
}

// 並行驗證多個頁面
async function validatePages(urls, concurrency = CONFIG.concurrency) {
  const results = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(validatePage));
    results.push(...batchResults);

    // 進度顯示
    const progress = Math.min(i + concurrency, urls.length);
    process.stdout.write(`\r   驗證進度: ${progress}/${urls.length}`);
  }
  console.log('\n');

  return results;
}

// 生成報告
function generateReport(results) {
  const summary = {
    total: results.length,
    passed: 0,
    failed: 0,
    withWarnings: 0,
    errors: [],
    warnings: [],
  };

  for (const result of results) {
    if (result.errors.length > 0) {
      summary.failed++;
      summary.errors.push({
        url: result.url,
        errors: result.errors,
      });
    } else {
      summary.passed++;
    }

    if (result.warnings.length > 0) {
      summary.withWarnings++;
      summary.warnings.push({
        url: result.url,
        warnings: result.warnings,
      });
    }
  }

  return summary;
}

// 主程式
async function main() {
  const args = process.argv.slice(2);
  const outputFormat = args.includes('--json') ? 'json' : 'text';
  const siteUrl = args.find((a) => a.startsWith('--url='))?.split('=')[1] || CONFIG.siteUrl;

  console.log('\n=== 全站 SEO 驗證 ===\n');
  console.log(`🌐 網站: ${siteUrl}\n`);

  // 1. 獲取 URL 列表
  const urls = await getUrlsFromSitemap(siteUrl);
  if (urls.length === 0) {
    console.error('❌ 沒有找到需要驗證的頁面');
    process.exit(1);
  }

  // 2. 驗證所有頁面
  console.log('🔍 驗證頁面...');
  const results = await validatePages(urls);

  // 3. 生成報告
  const report = generateReport(results);

  // 4. 輸出結果
  if (outputFormat === 'json') {
    console.log(JSON.stringify({ ...report, results }, null, 2));
  } else {
    console.log('=== 驗證結果 ===\n');
    console.log(`總頁面數: ${report.total}`);
    console.log(`✅ 通過: ${report.passed}`);
    console.log(`❌ 失敗: ${report.failed}`);
    console.log(`⚠️ 有警告: ${report.withWarnings}`);

    if (report.errors.length > 0) {
      console.log('\n--- 錯誤 ---\n');
      for (const item of report.errors) {
        const pageName = item.url.split('/').pop();
        console.log(`📄 ${pageName}`);
        for (const error of item.errors) {
          console.log(`   ❌ [${error.type}] ${error.field || ''} ${error.message}`);
        }
      }
    }

    if (report.warnings.length > 0 && !args.includes('--no-warnings')) {
      console.log('\n--- 警告 (前 5 個) ---\n');
      for (const item of report.warnings.slice(0, 5)) {
        const pageName = item.url.split('/').pop();
        console.log(`📄 ${pageName}`);
        for (const warning of item.warnings) {
          console.log(`   ⚠️ [${warning.type}] ${warning.field || ''} ${warning.message}`);
        }
      }
      if (report.warnings.length > 5) {
        console.log(`\n   ... 還有 ${report.warnings.length - 5} 個頁面有警告`);
      }
    }
  }

  // 5. 儲存完整結果
  if (args.includes('--save')) {
    const outputFile = 'site-validation-result.json';
    fs.writeFileSync(outputFile, JSON.stringify({ ...report, results }, null, 2));
    console.log(`\n📁 完整結果已儲存至 ${outputFile}`);
  }

  // 6. 退出碼
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ 執行錯誤:', error.message);
  process.exit(1);
});
