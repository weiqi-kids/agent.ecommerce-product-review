#!/usr/bin/env node
/**
 * SEO 頁面生成腳本
 *
 * 用法：
 *   node generate-seo-page.js [markdown-file] [output-dir]
 *   node generate-seo-page.js --all  # 處理所有警告和假貨報告
 *
 * 功能：
 *   - 解析 Markdown 報告
 *   - 生成獨立 HTML 頁面（含 JSON-LD Schema）
 *   - 支援 7 種必填 Schema + 條件式 Schema
 */

const fs = require('fs');
const path = require('path');

// 網站設定
const SITE_CONFIG = {
  name: '買前必看',
  url: 'https://ecommerce.weiqi.kids',
  description: '智慧分析電商評論，避開地雷產品',
  logo: 'https://ecommerce.weiqi.kids/logo.png',
  author: {
    name: '買前必看分析團隊',
    url: 'https://ecommerce.weiqi.kids/about',
    description: '專注於電商評論數據分析的 AI 團隊，透過機器學習技術解析數萬則真實用戶評論，為消費者提供客觀的購買建議。',
    expertise: ['電商評論分析', '消費者保護', '產品安全評估', '數據科學']
  },
  email: 'contact@weiqi.kids'
};

/**
 * 解析 Markdown 報告，提取關鍵資訊
 */
function parseMarkdownReport(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');

  // 提取標題
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : fileName;

  // 提取日期（從檔名）
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // 提取 ASIN（如果有）
  const asinMatch = content.match(/\*\*ASIN\*\*.*?\|\s*([A-Z0-9]{10})/i) ||
                    content.match(/ASIN.*?([A-Z0-9]{10})/i) ||
                    fileName.match(/^([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : null;

  // 提取產品名稱
  const productMatch = content.match(/\*\*產品\*\*.*?\|\s*(.+?)\s*\|/);
  const productName = productMatch ? productMatch[1].trim() : title.replace(/^產品安全警告[：:]\s*/, '');

  // 提取品牌
  const brandMatch = content.match(/\*\*品牌\*\*.*?\|\s*(.+?)\s*\|/);
  const brand = brandMatch ? brandMatch[1].trim() : null;

  // 提取重要安全提醒（作為描述）
  const safetyMatch = content.match(/## 重要安全提醒\s*\n\s*\*\*(.+?)\*\*/s);
  const description = safetyMatch
    ? safetyMatch[1].replace(/\n/g, ' ').substring(0, 200) + '...'
    : `${title} - 基於用戶評論的安全分析報告`;

  // 提取關鍵問題（用於 FAQ）
  const faqItems = [];

  // 從問題摘要提取
  const issueMatch = content.match(/### 核心問題[：:].+?\n([\s\S]+?)(?=\n###|\n---)/);
  if (issueMatch) {
    const issues = issueMatch[1].match(/\d+\.\s*\*\*(.+?)\*\*[：:]\s*(.+?)(?=\n\d+\.|\n|$)/g);
    if (issues) {
      issues.slice(0, 3).forEach(issue => {
        const parts = issue.match(/\*\*(.+?)\*\*[：:]\s*(.+)/);
        if (parts) {
          faqItems.push({
            question: `${productName} 有什麼 ${parts[1].toLowerCase()} 問題？`,
            answer: parts[2].trim()
          });
        }
      });
    }
  }

  // 提取行動建議（用於 FAQ）
  const actionMatch = content.match(/### 對考慮購買者\s*\n([\s\S]+?)(?=\n###|\n---)/);
  if (actionMatch) {
    faqItems.push({
      question: `應該購買 ${productName} 嗎？`,
      answer: actionMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').substring(0, 300).trim()
    });
  }

  // 提取替代方案
  const altMatch = content.match(/## 建議替代方案([\s\S]+?)(?=\n## |$)/);
  const alternatives = [];
  if (altMatch) {
    const altProducts = altMatch[1].match(/### .+?[：:]\s*(.+?)(?=\n###|\n---|\n## |$)/g);
    if (altProducts) {
      altProducts.forEach(alt => {
        const nameMatch = alt.match(/### .+?[：:]\s*(.+)/);
        if (nameMatch) {
          alternatives.push(nameMatch[1].trim());
        }
      });
    }
  }

  // 提取評分和評論數
  const ratingMatch = content.match(/\*\*平均評分\*\*.*?\|\s*([\d.]+)/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  const reviewCountMatch = content.match(/\*\*分析評論數\*\*.*?\|\s*(\d+)/);
  const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1]) : null;

  // 判斷報告類型
  const reportType = filePath.includes('/warnings/') ? 'warning'
                   : filePath.includes('/counterfeits/') ? 'counterfeit'
                   : filePath.includes('/comparisons/') ? 'comparison'
                   : filePath.includes('/recommendations/') ? 'recommendation'
                   : filePath.includes('/pain_points/') ? 'pain_point'
                   : 'report';

  // 提取關鍵警告（用於 key-answer）
  let keyAnswer = '';
  if (reportType === 'warning') {
    const warningMatch = content.match(/\*\*(.+?存在.+?風險.+?)\*\*/);
    if (warningMatch) {
      keyAnswer = warningMatch[1];
    } else {
      keyAnswer = description;
    }
  }

  return {
    title,
    date,
    asin,
    productName,
    brand,
    description,
    faqItems,
    alternatives,
    rating,
    reviewCount,
    reportType,
    keyAnswer,
    filePath,
    fileName,
    content
  };
}

/**
 * 生成 JSON-LD Schema
 */
function generateJsonLd(data) {
  const canonicalUrl = `${SITE_CONFIG.url}/pages/${data.reportType}s/${data.fileName}.html`;
  const docsifyUrl = `${SITE_CONFIG.url}/#/Narrator/${data.reportType}s/${data.fileName}`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      // 1. WebPage + Speakable
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "name": data.title,
        "description": data.description,
        "inLanguage": "zh-TW",
        "isPartOf": { "@id": `${SITE_CONFIG.url}#website` },
        "datePublished": data.date,
        "dateModified": data.date,
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": [
            ".key-answer",
            ".key-takeaway",
            ".article-summary",
            ".faq-answer"
          ]
        }
      },

      // 2. Article（含內嵌 WebSite）
      {
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        "mainEntityOfPage": { "@id": `${canonicalUrl}#webpage` },
        "headline": data.title,
        "description": data.description,
        "image": {
          "@type": "ImageObject",
          "url": `${SITE_CONFIG.url}/og-image.png`,
          "width": 1200,
          "height": 630
        },
        "author": { "@id": `${SITE_CONFIG.author.url}#person` },
        "publisher": { "@id": `${SITE_CONFIG.url}#organization` },
        "datePublished": data.date,
        "dateModified": data.date,
        "articleSection": data.reportType === 'warning' ? '安全警告' : '產品分析',
        "keywords": [data.productName, data.brand, '產品安全', '評論分析'].filter(Boolean).join(', '),
        "inLanguage": "zh-TW",
        "isAccessibleForFree": true,
        "isPartOf": {
          "@type": "WebSite",
          "@id": `${SITE_CONFIG.url}#website`,
          "name": SITE_CONFIG.name,
          "url": SITE_CONFIG.url,
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${SITE_CONFIG.url}/#/?s={search_term}`,
            "query-input": "required name=search_term"
          }
        }
      },

      // 3. Person（作者 E-E-A-T）
      {
        "@type": "Person",
        "@id": `${SITE_CONFIG.author.url}#person`,
        "name": SITE_CONFIG.author.name,
        "url": SITE_CONFIG.author.url,
        "description": SITE_CONFIG.author.description,
        "knowsAbout": SITE_CONFIG.author.expertise,
        "worksFor": {
          "@type": "Organization",
          "name": SITE_CONFIG.name
        }
      },

      // 4. Organization（出版者）
      {
        "@type": "Organization",
        "@id": `${SITE_CONFIG.url}#organization`,
        "name": SITE_CONFIG.name,
        "url": SITE_CONFIG.url,
        "logo": {
          "@type": "ImageObject",
          "url": SITE_CONFIG.logo,
          "width": 600,
          "height": 60
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "email": SITE_CONFIG.email
        }
      },

      // 5. BreadcrumbList（麵包屑）
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "首頁",
            "item": SITE_CONFIG.url
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": data.reportType === 'warning' ? '安全警告' : '產品分析',
            "item": `${SITE_CONFIG.url}/#/Narrator/${data.reportType}s/`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": data.title,
            "item": canonicalUrl
          }
        ]
      },

      // 6. ImageObject（主圖）
      {
        "@type": "ImageObject",
        "@id": `${canonicalUrl}#primaryimage`,
        "url": `${SITE_CONFIG.url}/og-image.png`,
        "width": 1200,
        "height": 630,
        "caption": data.title,
        "representativeOfPage": true
      }
    ]
  };

  // 7. FAQPage（如果有 FAQ）
  if (data.faqItems && data.faqItems.length > 0) {
    schema["@graph"].push({
      "@type": "FAQPage",
      "mainEntity": data.faqItems.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  // 條件式：Review + AggregateRating（如果有評分）
  if (data.rating && data.reviewCount) {
    schema["@graph"].push({
      "@type": "Review",
      "@id": `${canonicalUrl}#review`,
      "itemReviewed": {
        "@type": "Product",
        "name": data.productName,
        "brand": data.brand ? { "@type": "Brand", "name": data.brand } : undefined
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": data.reportType === 'warning' ? "1" : String(data.rating),
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": { "@id": `${SITE_CONFIG.author.url}#person` },
      "datePublished": data.date,
      "reviewBody": data.description
    });

    schema["@graph"].push({
      "@type": "AggregateRating",
      "itemReviewed": {
        "@type": "Product",
        "name": data.productName
      },
      "ratingValue": String(data.rating),
      "bestRating": "5",
      "ratingCount": String(data.reviewCount)
    });
  }

  return schema;
}

/**
 * 生成 HTML 頁面
 */
function generateHtmlPage(data) {
  const jsonLd = generateJsonLd(data);
  const canonicalUrl = `${SITE_CONFIG.url}/pages/${data.reportType}s/${data.fileName}.html`;
  const docsifyUrl = `${SITE_CONFIG.url}/#/Narrator/${data.reportType}s/${data.fileName}`;

  // 報告類型的中文名稱和 emoji
  const typeLabels = {
    warning: { label: '安全警告', emoji: '⚠️' },
    counterfeit: { label: '假貨警報', emoji: '🚨' },
    comparison: { label: '比較報告', emoji: '⚖️' },
    recommendation: { label: '推薦報告', emoji: '✅' },
    pain_point: { label: '痛點報告', emoji: '📊' },
    report: { label: '分析報告', emoji: '📋' }
  };

  const typeInfo = typeLabels[data.reportType] || typeLabels.report;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} | ${SITE_CONFIG.name}</title>
  <meta name="description" content="${data.description.replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${docsifyUrl}">

  <!-- Open Graph -->
  <meta property="og:title" content="${data.title}">
  <meta property="og:description" content="${data.description.replace(/"/g, '&quot;')}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${SITE_CONFIG.url}/og-image.png">
  <meta property="og:site_name" content="${SITE_CONFIG.name}">
  <meta property="og:locale" content="zh_TW">
  <meta property="article:published_time" content="${data.date}">
  <meta property="article:section" content="${typeInfo.label}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${data.title}">
  <meta name="twitter:description" content="${data.description.replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${SITE_CONFIG.url}/og-image.png">

  <!-- JSON-LD Schema -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <!-- 重導向到 Docsify -->
  <meta http-equiv="refresh" content="0; url=${docsifyUrl}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    .key-answer {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 16px;
      margin: 20px 0;
      font-weight: 500;
    }
    .key-takeaway {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 16px;
      margin: 20px 0;
    }
    .warning-badge {
      display: inline-block;
      background: #dc3545;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .redirect-notice {
      background: #e3f2fd;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin-top: 30px;
    }
    .faq-question {
      font-weight: 600;
      margin-top: 20px;
    }
    .faq-answer {
      margin-left: 20px;
      color: #555;
    }
    a {
      color: #007bff;
    }
  </style>
</head>
<body>
  <header>
    <span class="warning-badge">${typeInfo.emoji} ${typeInfo.label}</span>
    <h1>${data.title}</h1>
    <p><time datetime="${data.date}">${data.date}</time></p>
  </header>

  <main>
    <!-- SGE 關鍵答案 -->
    <p class="key-answer" data-question="${data.productName} 安全嗎">
      ${data.keyAnswer || data.description}
    </p>

    <section class="article-summary">
      <h2>摘要</h2>
      <p>${data.description}</p>
    </section>

    ${data.faqItems && data.faqItems.length > 0 ? `
    <section class="faq">
      <h2>常見問題</h2>
      ${data.faqItems.map(faq => `
      <div class="faq-item">
        <p class="faq-question">${faq.question}</p>
        <p class="faq-answer">${faq.answer}</p>
      </div>
      `).join('')}
    </section>
    ` : ''}

    ${data.alternatives && data.alternatives.length > 0 ? `
    <section class="key-takeaway">
      <h2>建議替代方案</h2>
      <ul>
        ${data.alternatives.map(alt => `<li>${alt}</li>`).join('')}
      </ul>
    </section>
    ` : ''}

    <div class="redirect-notice">
      <p>正在為您導向完整報告...</p>
      <p>如果沒有自動跳轉，請 <a href="${docsifyUrl}">點此前往</a></p>
    </div>
  </main>

  <footer>
    <p>本報告由 <a href="${SITE_CONFIG.url}">${SITE_CONFIG.name}</a> 智慧分析系統生成</p>
  </footer>
</body>
</html>`;

  return html;
}

/**
 * 處理單個檔案
 */
function processFile(inputPath, outputDir) {
  console.log(`📄 處理: ${inputPath}`);

  const data = parseMarkdownReport(inputPath);
  const html = generateHtmlPage(data);

  // 確保輸出目錄存在
  const typeDir = path.join(outputDir, `${data.reportType}s`);
  if (!fs.existsSync(typeDir)) {
    fs.mkdirSync(typeDir, { recursive: true });
  }

  // 寫入 HTML
  const outputPath = path.join(typeDir, `${data.fileName}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`✅ 產出: ${outputPath}`);

  return {
    inputPath,
    outputPath,
    data
  };
}

/**
 * 處理所有報告（所有類型）
 */
function processAll() {
  const docsDir = path.join(__dirname, '..', 'docs');
  const outputDir = path.join(docsDir, 'pages');

  // 所有報告類型目錄
  const dirs = [
    path.join(docsDir, 'Narrator', 'warnings'),
    path.join(docsDir, 'Narrator', 'counterfeits'),
    path.join(docsDir, 'Narrator', 'pain_points'),
    path.join(docsDir, 'Narrator', 'recommendations'),
    path.join(docsDir, 'Narrator', 'comparisons')
  ];

  const results = [];
  const stats = {
    warning: 0,
    counterfeit: 0,
    pain_point: 0,
    recommendation: 0,
    comparison: 0
  };

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      try {
        const result = processFile(path.join(dir, file), outputDir);
        results.push(result);
        if (stats[result.data.reportType] !== undefined) {
          stats[result.data.reportType]++;
        }
      } catch (err) {
        console.error(`❌ 錯誤處理 ${file}: ${err.message}`);
      }
    });
  });

  console.log(`\n🎉 完成! 共處理 ${results.length} 個檔案`);
  console.log('📊 統計:');
  Object.entries(stats).forEach(([type, count]) => {
    if (count > 0) console.log(`   ${type}: ${count}`);
  });

  return results;
}

/**
 * 生成 sitemap.xml
 */
function generateSitemap(results) {
  const docsDir = path.join(__dirname, '..', 'docs');

  // 報告類型優先級
  const priorityMap = {
    warning: '0.9',       // 安全警告最高優先
    counterfeit: '0.9',   // 假貨警報最高優先
    pain_point: '0.8',    // 痛點報告
    recommendation: '0.8', // 推薦報告
    comparison: '0.7'     // 比較報告
  };

  const urls = results.map(r => {
    const url = `${SITE_CONFIG.url}/pages/${r.data.reportType}s/${r.data.fileName}.html`;
    const priority = priorityMap[r.data.reportType] || '0.7';
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${r.data.date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_CONFIG.url}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls.join('\n')}
</urlset>`;

  const sitemapPath = path.join(docsDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(`📍 Sitemap: ${sitemapPath}`);
}

// 主程式
const args = process.argv.slice(2);

if (args[0] === '--all') {
  const results = processAll();
  generateSitemap(results);
} else if (args.length >= 1) {
  const inputPath = args[0];
  const outputDir = args[1] || path.join(__dirname, '..', 'docs', 'pages');
  const result = processFile(inputPath, outputDir);
  generateSitemap([result]);
} else {
  console.log(`
SEO 頁面生成腳本

用法:
  node generate-seo-page.js [markdown-file] [output-dir]
  node generate-seo-page.js --all

範例:
  node generate-seo-page.js docs/Narrator/warnings/example.md
  node generate-seo-page.js --all
`);
}
