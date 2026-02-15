// 自訂 VitePress 主題
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

// 自訂組件
import KeyAnswer from './components/KeyAnswer.vue'
import WarningBox from './components/WarningBox.vue'
import ProductCard from './components/ProductCard.vue'
import ComparisonTable from './components/ComparisonTable.vue'
import FAQSection from './components/FAQSection.vue'

// 自訂樣式
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 註冊全域組件
    app.component('KeyAnswer', KeyAnswer)
    app.component('WarningBox', WarningBox)
    app.component('ProductCard', ProductCard)
    app.component('ComparisonTable', ComparisonTable)
    app.component('FAQSection', FAQSection)
  }
} satisfies Theme
