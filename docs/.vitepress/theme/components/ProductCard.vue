<script setup lang="ts">
/**
 * ProductCard 組件
 * 用於顯示產品資訊卡片
 */
defineProps<{
  name: string
  asin?: string
  rating?: number
  reviewCount?: number
  price?: string
  image?: string
  verdict?: 'recommended' | 'neutral' | 'not-recommended'
}>()

const verdictConfig = {
  recommended: { icon: '✅', label: '推薦', class: 'recommended' },
  neutral: { icon: '⚖️', label: '中性', class: 'neutral' },
  'not-recommended': { icon: '⚠️', label: '不推薦', class: 'not-recommended' }
}
</script>

<template>
  <div class="product-card" :class="[verdict ? `product-card--${verdict}` : '']">
    <div v-if="image" class="product-card__image">
      <img :src="image" :alt="name" loading="lazy" />
    </div>
    <div class="product-card__content">
      <h3 class="product-card__name">{{ name }}</h3>

      <div v-if="rating" class="product-card__rating">
        <span class="stars">{{ '★'.repeat(Math.round(rating)) }}{{ '☆'.repeat(5 - Math.round(rating)) }}</span>
        <span class="score">{{ rating.toFixed(1) }}</span>
        <span v-if="reviewCount" class="count">({{ reviewCount.toLocaleString() }} 則評論)</span>
      </div>

      <div v-if="price" class="product-card__price">{{ price }}</div>

      <div v-if="asin" class="product-card__asin">
        <a :href="`https://www.amazon.com/dp/${asin}`" target="_blank" rel="noopener">
          Amazon 連結 →
        </a>
      </div>

      <div v-if="verdict" class="product-card__verdict" :class="verdictConfig[verdict].class">
        {{ verdictConfig[verdict].icon }} {{ verdictConfig[verdict].label }}
      </div>

      <div class="product-card__description">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  margin: 16px 0;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.product-card--recommended {
  border-color: var(--vp-c-green-1);
}

.product-card--not-recommended {
  border-color: var(--vp-c-danger-1);
}

.product-card__image {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
}

.product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card__content {
  flex: 1;
}

.product-card__name {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.product-card__rating {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.product-card__rating .stars {
  color: #f59e0b;
}

.product-card__rating .score {
  font-weight: 600;
}

.product-card__rating .count {
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.product-card__price {
  font-size: 20px;
  font-weight: 700;
  color: var(--vp-c-brand);
  margin-bottom: 8px;
}

.product-card__asin a {
  font-size: 13px;
  color: var(--vp-c-brand);
}

.product-card__verdict {
  display: inline-block;
  padding: 4px 12px;
  margin: 8px 0;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
}

.product-card__verdict.recommended {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
}

.product-card__verdict.not-recommended {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
}

.product-card__description {
  margin-top: 8px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .product-card {
    flex-direction: column;
  }

  .product-card__image {
    width: 100%;
    height: 200px;
  }
}
</style>
