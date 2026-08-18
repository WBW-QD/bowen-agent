<script setup>
import { ref, watch, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'
import ImageViewer from './ImageViewer.vue'
import { t } from '../i18n.js'
import aiAgentImg from '@/assets/AIagent.png'
import logoImg from '@/assets/logo.png'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  webSearch: { type: Boolean, default: false },
})

const viewAgent = ref(false)

const listRef = ref(null)

// 新消息出现时自动滚动到底部
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  },
)
</script>

<template>
  <!-- 外层包裹层：背景与滚动分离，保证 logo 背景不随对话滚动 -->
  <div class="msg-wrap">
    <div
      class="msg-bg"
      :class="{ 'is-blur': messages.length }"
      :style="{ '--logo-url': `url(${logoImg})` }"
      aria-hidden="true"
    ></div>

    <div ref="listRef" class="msg-list">
      <div class="msg-list-inner">
        <template v-if="messages.length">
          <MessageItem v-for="(m, i) in messages" :key="i" :message="m" :web-search="webSearch" />
        </template>
        <div v-else class="welcome">
          <img class="welcome-logo" :src="aiAgentImg" alt="Bowen Agent" @click="viewAgent = true" />
          <p class="welcome-title">{{ t('welcome') }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- agent 大图 -->
  <ImageViewer :src="aiAgentImg" alt="Bowen Agent" v-model:open="viewAgent" />
</template>

<style scoped>
/* 外层包裹：背景固定不随滚动 */
.msg-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.msg-list {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* logo 铺满背景：默认清晰 + 边缘淡出；is-blur（有对话）整体变模糊 */
.msg-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: var(--logo-url);
  background-size: cover;
  background-position: center;
  opacity: 0.3;
  transition: opacity 0.6s ease, filter 0.6s ease;
  -webkit-mask-image: radial-gradient(
    ellipse at center,
    #000 40%,
    transparent 78%
  );
  mask-image: radial-gradient(ellipse at center, #000 40%, transparent 78%);
}

.msg-bg.is-blur {
  opacity: 0.12;
  filter: blur(8px);
}

.msg-list-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 24px 12px;
}

.welcome {
  position: relative;
  height: 100%;
  min-height: 55vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  text-align: center;
  overflow: hidden;
  padding: 24px;
}

.welcome-title {
  position: relative;
  z-index: 1;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #ffffff, #b9a8ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.welcome-logo {
  position: relative;
  z-index: 1;
  width: 156px;
  height: 156px;
  border-radius: 50%;
  object-fit: cover;
  cursor: zoom-in;
  box-shadow: 0 16px 56px rgba(124, 108, 255, 0.5);
  animation: float 4s ease-in-out infinite;
}

/* 手机端：欢迎页与列表内边距收紧 */
@media (max-width: 768px) {
  .msg-list-inner {
    padding: 16px 12px 8px;
  }

  .welcome {
    min-height: 45vh;
    gap: 24px;
  }

  .welcome-logo {
    width: 112px;
    height: 112px;
  }

  .welcome-title {
    font-size: 26px;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
