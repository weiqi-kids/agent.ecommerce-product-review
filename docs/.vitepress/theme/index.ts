// 自訂 VitePress 主題
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

// 自訂 Layout（報告頁自動注入元件）
import ReportLayout from './ReportLayout.vue'

// 自訂組件
import KeyAnswer from './components/KeyAnswer.vue'
import WarningBox from './components/WarningBox.vue'
import ProductCard from './components/ProductCard.vue'
import ComparisonTable from './components/ComparisonTable.vue'
import FAQSection from './components/FAQSection.vue'
import ReportSummary from './components/ReportSummary.vue'
import ShareButtons from './components/ShareButtons.vue'
import RelatedReports from './components/RelatedReports.vue'

// 自訂樣式
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: ReportLayout,
  enhanceApp({ app }) {
    // 註冊全域組件
    app.component('KeyAnswer', KeyAnswer)
    app.component('WarningBox', WarningBox)
    app.component('ProductCard', ProductCard)
    app.component('ComparisonTable', ComparisonTable)
    app.component('FAQSection', FAQSection)
    app.component('ReportSummary', ReportSummary)
    app.component('ShareButtons', ShareButtons)
    app.component('RelatedReports', RelatedReports)
  }
} satisfies Theme
