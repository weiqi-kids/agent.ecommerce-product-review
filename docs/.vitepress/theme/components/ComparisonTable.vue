<script setup lang="ts">
/**
 * ComparisonTable 組件
 * 用於顯示產品比較表格
 */
interface Product {
  name: string
  asin?: string
  rating?: number
  price?: string
  pros?: string[]
  cons?: string[]
  isHighlighted?: boolean
}

defineProps<{
  products: Product[]
  aspects?: string[]
}>()
</script>

<template>
  <div class="comparison-table-wrapper">
    <table class="comparison-table">
      <thead>
        <tr>
          <th>產品</th>
          <th>評分</th>
          <th>價格</th>
          <th>優點</th>
          <th>缺點</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="product in products"
          :key="product.name"
          :class="{ highlighted: product.isHighlighted }"
        >
          <td class="product-name">
            <strong>{{ product.name }}</strong>
            <span v-if="product.isHighlighted" class="badge">✓ 本報告主角</span>
            <a
              v-if="product.asin"
              :href="`https://www.amazon.com/dp/${product.asin}`"
              target="_blank"
              rel="noopener"
              class="amazon-link"
            >
              Amazon →
            </a>
          </td>
          <td class="rating">
            <span v-if="product.rating" class="stars">
              {{ '★'.repeat(Math.round(product.rating)) }}
            </span>
            {{ product.rating?.toFixed(1) || '-' }}
          </td>
          <td class="price">{{ product.price || '-' }}</td>
          <td class="pros">
            <ul v-if="product.pros?.length">
              <li v-for="pro in product.pros" :key="pro">{{ pro }}</li>
            </ul>
            <span v-else>-</span>
          </td>
          <td class="cons">
            <ul v-if="product.cons?.length">
              <li v-for="con in product.cons" :key="con">{{ con }}</li>
            </ul>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.comparison-table-wrapper {
  overflow-x: auto;
  margin: 24px 0;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.comparison-table th,
.comparison-table td {
  padding: 12px;
  text-align: left;
  border: 1px solid var(--vp-c-divider);
}

.comparison-table th {
  background: var(--vp-c-bg-soft);
  font-weight: 600;
  white-space: nowrap;
}

.comparison-table tr.highlighted {
  background: var(--vp-c-brand-soft);
}

.comparison-table tr.highlighted td {
  border-color: var(--vp-c-brand);
}

.product-name {
  min-width: 150px;
}

.product-name .badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  background: var(--vp-c-brand);
  color: white;
  font-size: 11px;
  border-radius: 4px;
}

.product-name .amazon-link {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--vp-c-brand);
}

.rating {
  white-space: nowrap;
}

.rating .stars {
  color: #f59e0b;
}

.price {
  font-weight: 600;
  color: var(--vp-c-brand);
}

.pros ul,
.cons ul {
  margin: 0;
  padding-left: 16px;
}

.pros li {
  color: var(--vp-c-green-1);
}

.cons li {
  color: var(--vp-c-danger-1);
}

@media (max-width: 768px) {
  .comparison-table {
    font-size: 12px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 8px;
  }
}
</style>
