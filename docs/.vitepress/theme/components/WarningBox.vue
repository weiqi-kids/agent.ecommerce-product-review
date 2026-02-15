<script setup lang="ts">
/**
 * WarningBox 組件
 * 用於顯示產品安全警告
 */
defineProps<{
  severity?: 'critical' | 'high' | 'medium' | 'low'
  title?: string
}>()

const severityConfig = {
  critical: { icon: '🔴', label: '嚴重', color: '#dc2626' },
  high: { icon: '🟠', label: '高度', color: '#ea580c' },
  medium: { icon: '🟡', label: '中度', color: '#ca8a04' },
  low: { icon: '🟢', label: '低度', color: '#16a34a' }
}
</script>

<template>
  <div
    class="warning-box"
    :class="[`warning-box--${severity || 'high'}`]"
    role="alert"
  >
    <div class="warning-box__header">
      <span class="warning-box__icon">
        {{ severityConfig[severity || 'high'].icon }}
      </span>
      <span class="warning-box__severity">
        {{ severityConfig[severity || 'high'].label }}風險
      </span>
      <span v-if="title" class="warning-box__title">
        {{ title }}
      </span>
    </div>
    <div class="warning-box__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.warning-box {
  padding: 16px 20px;
  margin: 24px 0;
  border-radius: 8px;
  border: 1px solid;
}

.warning-box--critical {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.warning-box--high {
  border-color: #ea580c;
  background: rgba(234, 88, 12, 0.1);
}

.warning-box--medium {
  border-color: #ca8a04;
  background: rgba(202, 138, 4, 0.1);
}

.warning-box--low {
  border-color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
}

.warning-box__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.warning-box__icon {
  font-size: 20px;
}

.warning-box__severity {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.warning-box__title {
  flex: 1;
  font-size: 16px;
}

.warning-box__content {
  font-size: 14px;
  line-height: 1.6;
}

.warning-box__content :deep(ul) {
  margin: 8px 0;
  padding-left: 20px;
}

.warning-box__content :deep(li) {
  margin: 4px 0;
}
</style>
