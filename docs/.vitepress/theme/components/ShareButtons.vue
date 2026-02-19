<script setup lang="ts">
import { ref, computed } from 'vue'
import { useData } from 'vitepress'

const { page, frontmatter } = useData()

const copied = ref(false)

// 當前頁面 URL
const pageUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.href
  }
  return ''
})

// 頁面標題
const pageTitle = computed(() => {
  return frontmatter.value.title || page.value.title || '買前必看報告'
})

// 分享文案
const shareText = computed(() => {
  return `這篇 Amazon 評論分析報告值得一看：${pageTitle.value}`
})

// 複製連結
async function copyLink() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(pageUrl.value)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch (err) {
      console.error('複製失敗:', err)
    }
  }
}

// Twitter 分享
function shareTwitter() {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.value)}&url=${encodeURIComponent(pageUrl.value)}`
  window.open(url, '_blank', 'width=550,height=420')
}

// Facebook 分享
function shareFacebook() {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl.value)}`
  window.open(url, '_blank', 'width=550,height=420')
}

// LINE 分享
function shareLine() {
  const url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl.value)}`
  window.open(url, '_blank', 'width=550,height=420')
}
</script>

<template>
  <div class="share-buttons">
    <span class="share-label">分享這篇報告：</span>
    <div class="buttons">
      <button @click="copyLink" class="share-btn copy-btn" :class="{ copied }">
        {{ copied ? '✓ 已複製' : '📋 複製連結' }}
      </button>
      <button @click="shareTwitter" class="share-btn twitter-btn">
        𝕏
      </button>
      <button @click="shareFacebook" class="share-btn facebook-btn">
        f
      </button>
      <button @click="shareLine" class="share-btn line-btn">
        LINE
      </button>
    </div>
  </div>
</template>

<style scoped>
.share-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 32px;
  padding: 16px 0;
  flex-wrap: wrap;
}

.share-label {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.share-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.copy-btn {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.copy-btn:hover {
  background: var(--vp-c-bg-mute);
}

.copy-btn.copied {
  background: #16a34a;
  color: white;
}

.twitter-btn {
  background: #000;
  color: white;
  font-weight: 700;
}

.twitter-btn:hover {
  background: #333;
}

.facebook-btn {
  background: #1877f2;
  color: white;
  font-weight: 700;
}

.facebook-btn:hover {
  background: #0d65d9;
}

.line-btn {
  background: #00b900;
  color: white;
  font-size: 12px;
}

.line-btn:hover {
  background: #009900;
}

@media (max-width: 640px) {
  .share-buttons {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
