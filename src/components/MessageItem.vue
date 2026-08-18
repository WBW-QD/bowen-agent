<script setup>
import { ref, computed } from 'vue'
import aiAgentImg from '@/assets/AIagent.png'
import ImageViewer from './ImageViewer.vue'

const props = defineProps({
  message: { type: Object, required: true }, // { role: 'user' | 'assistant', content }
  webSearch: { type: Boolean, default: false },
})

const isUser = computed(() => props.message.role === 'user')
const viewAgent = ref(false)
</script>

<template>
  <div class="msg" :class="isUser ? 'msg-user' : 'msg-ai'">
    <!-- AI 头像（点击查看大图） -->
    <img
      v-if="!isUser"
      class="avatar avatar-clickable"
      :src="aiAgentImg"
      alt="Bowen Agent"
      @click="viewAgent = true"
    />

    <div class="bubble">
      <p v-if="message.content" class="content">{{ message.content }}</p>
      <!-- 等待第一段内容时的动画：联网模式显示搜索中，否则三点 -->
      <div v-else class="thinking" :aria-label="webSearch ? '正在联网搜索' : '正在思考'">
        <template v-if="webSearch">
          <span class="searching">🔍 正在联网搜索…</span>
        </template>
        <template v-else>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </template>
      </div>
    </div>

    <!-- 用户头像 -->
    <div v-if="isUser" class="avatar avatar-user">我</div>
  </div>

  <!-- AI 头像大图 -->
  <ImageViewer :src="aiAgentImg" alt="Bowen Agent" v-model:open="viewAgent" />
</template>

<style scoped>
.msg {
  display: flex;
  gap: 12px;
  padding: 14px 0;
}

.msg-user {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.avatar-clickable {
  cursor: zoom-in;
}

.avatar-user {
  display: grid;
  place-items: center;
  background: #3a4057;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.bubble {
  max-width: min(720px, 82%);
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: calc(var(--font-base, 15px) - 0.5px);
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.msg-ai .bubble {
  background: linear-gradient(180deg, var(--bubble-ai-top), var(--bubble-ai-bottom));
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top-left-radius: 4px;
}

.msg-user .bubble {
  background: linear-gradient(180deg, var(--bubble-user-top), var(--bubble-user-bottom));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top-right-radius: 4px;
}

.content {
  line-height: 1.7;
}

/* 思考中动画容器 */
.thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 2px;
  white-space: nowrap;
}

/* 联网搜索中文字（独立于小圆点，防止被误设成点） */
.thinking .searching {
  display: inline-block;
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

/* 三个点 */
.thinking .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: blink 1.2s infinite ease-in-out;
}

.thinking .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 手机端：气泡更宽些，头像略小 */
@media (max-width: 768px) {
  .bubble {
    max-width: 88%;
    padding: 9px 12px;
    font-size: 14px;
  }

  .avatar {
    width: 28px;
    height: 28px;
  }
}
</style>
