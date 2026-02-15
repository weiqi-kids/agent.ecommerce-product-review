<script setup lang="ts">
/**
 * KeyAnswer 組件
 * 用於顯示關鍵答案，支援 SGE/AEO 語音搜尋優化
 * 使用 .key-answer 類別供 Speakable Schema 識別
 */
defineProps<{
  type?: 'info' | 'warning' | 'success' | 'danger'
}>()
</script>

<template>
  <div
    class="key-answer"
    :class="[`key-answer--${type || 'info'}`]"
    role="region"
    aria-label="關鍵摘要"
  >
    <div class="key-answer__icon">
      <span v-if="type === 'warning'">⚠️</span>
      <span v-else-if="type === 'danger'">🚨</span>
      <span v-else-if="type === 'success'">✅</span>
      <span v-else>💡</span>
    </div>
    <div class="key-answer__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.key-answer {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  margin: 24px 0;
  border-radius: 8px;
  border-left: 4px solid;
  background: var(--vp-c-bg-soft);
}

.key-answer--info {
  border-left-color: var(--vp-c-brand);
  background: var(--vp-c-brand-soft);
}

.key-answer--warning {
  border-left-color: var(--vp-c-warning-1);
  background: var(--vp-c-warning-soft);
}

.key-answer--success {
  border-left-color: var(--vp-c-green-1);
  background: var(--vp-c-green-soft);
}

.key-answer--danger {
  border-left-color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.key-answer__icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.key-answer__content {
  flex: 1;
  font-size: 15px;
  line-height: 1.6;
}

.key-answer__content :deep(p) {
  margin: 0;
}

.key-answer__content :deep(p + p) {
  margin-top: 8px;
}
</style>
