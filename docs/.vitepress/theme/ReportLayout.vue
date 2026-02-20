<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ReportSummary from './components/ReportSummary.vue'
import ShareButtons from './components/ShareButtons.vue'
import RelatedReports from './components/RelatedReports.vue'

const { Layout } = DefaultTheme
const { page, frontmatter } = useData()

// 判斷是否為報告頁面
const isReportPage = computed(() => {
  const path = page.value.relativePath
  return path.startsWith('Narrator/') && !path.endsWith('index.md')
})

// 從路徑判斷報告類型
const reportType = computed(() => {
  const path = page.value.relativePath
  if (path.includes('warnings')) return 'warning'
  if (path.includes('counterfeits')) return 'warning'
  if (path.includes('pain_points')) return 'caution'
  if (path.includes('recommendations')) return 'recommend'
  if (path.includes('comparisons')) return 'neutral'
  return 'neutral'
})

// 從 frontmatter 取得報告資料
const summaryData = computed(() => ({
  verdict: frontmatter.value.verdict || reportType.value,
  reviewCount: frontmatter.value.reviewCount,
  negativeRate: frontmatter.value.negativeRate,
  issues: frontmatter.value.issues
}))

// 相關報告（從 frontmatter 或自動生成）
const relatedReports = computed(() => {
  return frontmatter.value.relatedReports || []
})
</script>

<template>
  <Layout>
    <!-- 報告頁面：在內容前插入摘要 -->
    <template #doc-before>
      <ReportSummary
        v-if="isReportPage"
        :verdict="summaryData.verdict"
        :review-count="summaryData.reviewCount"
        :negative-rate="summaryData.negativeRate"
        :issues="summaryData.issues"
      />
    </template>

    <!-- 報告頁面：在內容後插入分享和相關報告 -->
    <template #doc-after>
      <template v-if="isReportPage">
        <ShareButtons />
        <RelatedReports
          v-if="relatedReports.length > 0"
          :reports="relatedReports"
        />
      </template>
    </template>
  </Layout>
</template>
