import { defineConfig, HeadConfig } from 'vitepress'

// 網站基本設定
const siteTitle = '買前必看'
const siteDescription = '電商商品評論智慧分析系統 — AI 驅動的產品安全與品質分析'
const siteUrl = 'https://ecommerce.weiqi.kids'

// 生成 JSON-LD Schema
function generateJsonLd(pageData: any): string {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: siteTitle,
        description: siteDescription,
        publisher: { '@id': `${siteUrl}#organization` },
        inLanguage: 'zh-TW'
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: siteTitle,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630
        },
        description: '專注於電商評論數據分析的 AI 團隊'
      },
      {
        '@type': 'Person',
        '@id': `${siteUrl}/about#person`,
        name: '買前必看團隊',
        url: `${siteUrl}/about`,
        worksFor: { '@id': `${siteUrl}#organization` }
      }
    ]
  }
  return JSON.stringify(baseSchema)
}

export default defineConfig({
  // 基本設定
  title: siteTitle,
  description: siteDescription,
  lang: 'zh-TW',

  // 輸出目錄
  outDir: '../dist',

  // 清理 URL（移除 .html）
  cleanUrls: true,

  // URL 重寫
  rewrites: {
    'README.md': 'index.md'
  },

  // 最後更新時間
  lastUpdated: true,

  // 死連結檢查（所有連結已修復）
  ignoreDeadLinks: false,

  // Head 標籤
  head: [
    // Favicon
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],

    // Open Graph 基本設定
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    ['meta', { property: 'og:locale', content: 'zh_TW' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.png` }],

    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.png` }],

    // 基本 JSON-LD（頁面特定的會在 transformHead 中加入）
    ['script', { type: 'application/ld+json' }, generateJsonLd({})]
  ],

  // 頁面標題模板
  titleTemplate: ':title | 買前必看',

  // Markdown 設定
  markdown: {
    lineNumbers: false,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // 主題設定
  themeConfig: {
    // Logo
    logo: '/logo.svg',

    // 網站標題
    siteTitle: '買前必看',

    // 導航欄
    nav: [
      { text: '首頁', link: '/' },
      { text: '關於我們', link: '/about' },
      {
        text: '報告類型',
        items: [
          { text: '⚠️ 警告報告', link: '/Narrator/warnings/' },
          { text: '🚨 假貨報告', link: '/Narrator/counterfeits/' },
          { text: '📊 痛點報告', link: '/Narrator/pain_points/' },
          { text: '✅ 推薦報告', link: '/Narrator/recommendations/' },
          { text: '⚖️ 比較報告', link: '/Narrator/comparisons/' }
        ]
      }
    ],

    // 側邊欄（動態生成）
    sidebar: {
      '/Narrator/warnings/': [
        {
          text: '⚠️ 警告報告',
          items: [] // 將由 sidebar 插件動態填充
        }
      ],
      '/Narrator/counterfeits/': [
        {
          text: '🚨 假貨報告',
          items: []
        }
      ],
      '/Narrator/pain_points/': [
        {
          text: '📊 痛點報告',
          items: []
        }
      ],
      '/Narrator/recommendations/': [
        {
          text: '✅ 推薦報告',
          items: []
        }
      ],
      '/Narrator/comparisons/': [
        {
          text: '⚖️ 比較報告',
          items: []
        }
      ]
    },

    // 社群連結
    socialLinks: [
      { icon: 'github', link: 'https://github.com/weiqi-kids/agent.ecommerce-product-review' }
    ],

    // 頁尾
    footer: {
      message: '基於公開評論資料的自動化分析，僅供參考',
      copyright: '© 2026 買前必看'
    },

    // 搜尋
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜尋',
            buttonAriaLabel: '搜尋'
          },
          modal: {
            noResultsText: '找不到結果',
            resetButtonTitle: '清除搜尋',
            footer: {
              selectText: '選擇',
              navigateText: '導航',
              closeText: '關閉'
            }
          }
        }
      }
    },

    // 文章底部上下篇
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    // 大綱
    outline: {
      label: '本頁目錄',
      level: [2, 3]
    },

    // 最後更新
    lastUpdated: {
      text: '最後更新'
    },

    // 返回頂部
    returnToTopLabel: '返回頂部'
  },

  // 自動生成 sitemap
  sitemap: {
    hostname: siteUrl
  },

  // 頁面轉換（添加頁面特定的 SEO）
  transformHead({ pageData, head }) {
    // 頁面特定的 Open Graph
    const title = pageData.title || siteTitle
    const description = pageData.description || pageData.frontmatter?.description || siteDescription
    const url = `${siteUrl}/${pageData.relativePath.replace(/\.md$/, '')}`

    const pageHead: HeadConfig[] = [
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['link', { rel: 'canonical', href: url }]
    ]

    // 如果是報告頁面，添加 Article Schema
    if (pageData.relativePath.includes('Narrator/')) {
      const articleType = getReportType(pageData.relativePath)
      const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description: description,
        url: url,
        datePublished: pageData.frontmatter?.date || new Date().toISOString().split('T')[0],
        dateModified: pageData.lastUpdated || pageData.frontmatter?.date || new Date().toISOString().split('T')[0],
        author: { '@id': `${siteUrl}/about#person` },
        publisher: { '@id': `${siteUrl}#organization` },
        articleSection: articleType,
        inLanguage: 'zh-TW'
      }
      pageHead.push(['script', { type: 'application/ld+json' }, JSON.stringify(articleSchema)])
    }

    return pageHead
  },

  // 構建時轉換頁面 HTML
  transformPageData(pageData) {
    // 從檔案路徑提取日期
    const dateMatch = pageData.relativePath.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch && !pageData.frontmatter.date) {
      pageData.frontmatter.date = dateMatch[1]
    }
  }
})

// 輔助函數：判斷報告類型
function getReportType(path: string): string {
  if (path.includes('warnings')) return '警告報告'
  if (path.includes('counterfeits')) return '假貨報告'
  if (path.includes('pain_points')) return '痛點報告'
  if (path.includes('recommendations')) return '推薦報告'
  if (path.includes('comparisons')) return '比較報告'
  return '產品分析'
}
