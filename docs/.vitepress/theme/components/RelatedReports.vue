<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page, theme } = useData()

// 從當前頁面路徑判斷報告類型
const reportType = computed(() => {
  const path = page.value.relativePath
  if (path.includes('warnings')) return 'warnings'
  if (path.includes('counterfeits')) return 'counterfeits'
  if (path.includes('pain_points')) return 'pain_points'
  if (path.includes('recommendations')) return 'recommendations'
  if (path.includes('comparisons')) return 'comparisons'
  return ''
})

// 報告類型對應
const typeConfig = {
  warnings: { label: '⚠️ 警告報告', color: '#ea580c' },
  counterfeits: { label: '🚨 假貨報告', color: '#dc2626' },
  pain_points: { label: '📊 痛點報告', color: '#3b82f6' },
  recommendations: { label: '✅ 推薦報告', color: '#16a34a' },
  comparisons: { label: '⚖️ 比較報告', color: '#8b5cf6' }
}

// Props
defineProps<{
  reports?: Array<{
    title: string
    link: string
    type?: string
  }>
}>()
</script>

<template>
  <div v-if="reports && reports.length > 0" class="related-reports">
    <h3>📚 相關報告</h3>
    <div class="reports-grid">
      <a
        v-for="report in reports"
        :key="report.link"
        :href="report.link"
        class="report-card"
      >
        <span
          v-if="report.type && typeConfig[report.type]"
          class="report-type"
          :style="{ color: typeConfig[report.type].color }"
        >
          {{ typeConfig[report.type].label }}
        </span>
        <span class="report-title">{{ report.title }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.related-reports {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--vp-c-divider);
}

.related-reports h3 {
  font-size: 18px;
  margin-bottom: 16px;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.report-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.report-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.report-type {
  font-size: 12px;
  font-weight: 600;
}

.report-title {
  color: var(--vp-c-text-1);
  font-weight: 500;
}

@media (max-width: 640px) {
  .reports-grid {
    grid-template-columns: 1fr;
  }
}
</style>
