<script setup lang="ts">
defineProps<{
  verdict: 'recommend' | 'warning' | 'caution' | 'neutral'
  reviewCount?: number
  negativeRate?: number
  issues?: string[]
}>()

const verdictConfig = {
  recommend: { icon: '✅', label: '推薦', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  warning: { icon: '⚠️', label: '警告', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' },
  caution: { icon: '🟡', label: '需注意', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)' },
  neutral: { icon: '📊', label: '中立', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }
}
</script>

<template>
  <div class="report-summary" :style="{ background: (verdictConfig[verdict] || verdictConfig.neutral).bg }">
    <div class="verdict" :style="{ color: (verdictConfig[verdict] || verdictConfig.neutral).color }">
      <span class="verdict-icon">{{ (verdictConfig[verdict] || verdictConfig.neutral).icon }}</span>
      <span class="verdict-label">{{ (verdictConfig[verdict] || verdictConfig.neutral).label }}</span>
    </div>

    <div class="metrics">
      <div v-if="reviewCount" class="metric">
        <span class="metric-value">{{ reviewCount.toLocaleString() }}</span>
        <span class="metric-label">則評論</span>
      </div>
      <div v-if="negativeRate" class="metric">
        <span class="metric-value">{{ negativeRate }}%</span>
        <span class="metric-label">負評率</span>
      </div>
      <div v-if="issues && issues.length" class="metric">
        <span class="metric-value">{{ issues.length }}</span>
        <span class="metric-label">個問題</span>
      </div>
    </div>

    <div v-if="issues && issues.length" class="issues">
      <div class="issues-label">📌 主要發現：</div>
      <ul>
        <li v-for="issue in issues" :key="issue">{{ issue }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.report-summary {
  padding: 20px;
  border-radius: 12px;
  margin: 20px 0;
}

.verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
}

.verdict-icon {
  font-size: 28px;
}

.metrics {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.metric {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.metric-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.issues {
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.issues-label {
  font-weight: 600;
  margin-bottom: 8px;
}

.issues ul {
  margin: 0;
  padding-left: 20px;
}

.issues li {
  margin: 4px 0;
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .metrics {
    gap: 16px;
  }

  .metric-value {
    font-size: 20px;
  }
}
</style>
