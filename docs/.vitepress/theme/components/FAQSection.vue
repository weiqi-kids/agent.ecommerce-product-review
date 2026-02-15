<script setup lang="ts">
/**
 * FAQSection 組件
 * 用於顯示常見問題，支援 FAQ Schema
 */
import { ref } from 'vue'

interface FAQ {
  question: string
  answer: string
}

defineProps<{
  faqs: FAQ[]
}>()

const openIndex = ref<number | null>(null)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<template>
  <div class="faq-section" itemscope itemtype="https://schema.org/FAQPage">
    <div
      v-for="(faq, index) in faqs"
      :key="index"
      class="faq-item"
      itemscope
      itemprop="mainEntity"
      itemtype="https://schema.org/Question"
    >
      <button
        class="faq-question"
        :class="{ open: openIndex === index }"
        @click="toggle(index)"
        :aria-expanded="openIndex === index"
      >
        <span itemprop="name">{{ faq.question }}</span>
        <span class="faq-icon">{{ openIndex === index ? '−' : '+' }}</span>
      </button>
      <div
        v-show="openIndex === index"
        class="faq-answer"
        itemscope
        itemprop="acceptedAnswer"
        itemtype="https://schema.org/Answer"
      >
        <div itemprop="text" class="faq-answer-text">
          {{ faq.answer }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-section {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.faq-item {
  border-bottom: 1px solid var(--vp-c-divider);
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 16px 20px;
  background: var(--vp-c-bg-soft);
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  transition: background 0.2s;
}

.faq-question:hover {
  background: var(--vp-c-bg-mute);
}

.faq-question.open {
  background: var(--vp-c-brand-soft);
}

.faq-icon {
  font-size: 20px;
  font-weight: 300;
  color: var(--vp-c-text-2);
}

.faq-answer {
  padding: 16px 20px;
  background: var(--vp-c-bg);
}

.faq-answer-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
</style>
