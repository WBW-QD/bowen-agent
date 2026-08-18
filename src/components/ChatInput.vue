<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { lang, t } from '../i18n.js'

const props = defineProps({
  sending: { type: Boolean, default: false },
  models: { type: Array, default: () => [] },
})
const emit = defineEmits(['send'])

const webSearch = defineModel('webSearch', { type: Boolean, default: false })
const model = defineModel('model', { type: String, default: '' })

const text = ref('')
const textareaRef = ref(null)

// ===== 推荐问题（前端自动生成，中英双语） =====
const INFO_QUESTIONS_ZH = [
  '你是谁？',
  '你是怎么出现的？',
  '你的创造者是谁？',
  '你会做什么？',
  '你创建于什么时候？',
  '你能联网吗？',
  '你有记忆吗？',
  '今天是几号？',
  '现在几点了？',
  '你的能力有哪些？',
]

const INFO_QUESTIONS_EN = [
  'Who are you?',
  'How did you come to exist?',
  'Who created you?',
  'What can you do?',
  'When were you created?',
  'Can you go online?',
  'Do you have memory?',
  "What's today's date?",
  'What time is it?',
  'What are your abilities?',
]

const TOPIC_QUESTIONS_ZH = [
  '用一句话介绍 Vue 3',
  '帮我写一个 Python 冒泡排序',
  '什么是大语言模型？',
  '2026 年有什么值得关注的事件？',
  '给我讲个冷笑话',
  '如何快速学会编程？',
  '推荐一本 AI 相关的书',
  '什么是 RAG 检索增强生成？',
  '周末在家有什么推荐活动？',
  '如何规划一个前端项目？',
  '给我写一段 Vue 计数器代码',
  '什么是量子计算？',
]

const TOPIC_QUESTIONS_EN = [
  'Explain Vue 3 in one sentence',
  'Write a Python bubble sort',
  'What is a large language model?',
  'Any major events in 2026?',
  'Tell me a joke',
  'How to learn programming fast?',
  'Recommend an AI book',
  'What is RAG?',
  'Ideas for a weekend at home?',
  'How to plan a frontend project?',
  'Write a Vue counter component',
  'What is quantum computing?',
]

const suggestions = ref([])

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 生成一轮推荐：至少一条"询问信息"的问题，数量随问题长度自适应
function generateSuggestions() {
  const infoPool = lang.value === 'en' ? INFO_QUESTIONS_EN : INFO_QUESTIONS_ZH
  const topicPool = lang.value === 'en' ? TOPIC_QUESTIONS_EN : TOPIC_QUESTIONS_ZH
  const info = shuffle(infoPool)
  const topic = shuffle(topicPool)
  const pool = [info[0], ...topic.slice(0, 6)]
  const avgLen = pool.reduce((s, q) => s + q.length, 0) / pool.length
  const count = avgLen > 18 ? 3 : avgLen > 12 ? 4 : 5
  const result = [info[0]]
  for (let i = 0; i < count - 1 && i < topic.length; i++) result.push(topic[i])
  return result.slice(0, count)
}

function regenerate() {
  suggestions.value = generateSuggestions()
}

function pick(q) {
  emit('send', q)
}

onMounted(regenerate)
// 语言切换时重新生成推荐问题
watch(lang, regenerate)

// 自适应高度
watch(text, async () => {
  await nextTick()
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
})

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  if (props.sending) return
  const value = text.value.trim()
  if (!value) return
  emit('send', value)
  text.value = ''
  resetHeight()
}

function resetHeight() {
  const el = textareaRef.value
  if (el) el.style.height = 'auto'
}

defineExpose({ submit })
</script>

<template>
  <footer class="input-area">
    <!-- 推荐问题：可点击直接提问，🔄 换一批 -->
    <div class="suggest-row">
      <div class="suggest-chips">
        <button v-for="q in suggestions" :key="q" class="suggest-chip" @click="pick(q)">{{ q }}</button>
      </div>
      <button class="suggest-refresh" :title="t('refresh')" @click="regenerate">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-2.6-6.4" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>

    <div class="input-box">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="input"
        rows="1"
        :placeholder="t('inputPlaceholder')"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="send-btn"
        :disabled="sending || !text.trim()"
        :title="sending ? '生成中…' : text.trim() ? '发送' : '请输入内容'"
        @click="submit"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
        </svg>
      </button>
    </div>

    <div class="toolbar">
      <!-- 联网搜索开关 -->
      <button class="web-btn" :class="{ on: webSearch }" title="联网搜索后回答" @click="webSearch = !webSearch">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9z" />
        </svg>
        {{ t('webSearch') }}
        <span class="dot"></span>
      </button>

      <!-- 模型切换 -->
      <select v-model="model" class="model-select" title="选择模型">
        <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>

    <p class="hint">{{ t('hint') }}</p>
  </footer>
</template>

<style scoped>
.input-area {
  padding: 12px 24px 18px;
  background: linear-gradient(180deg, transparent, rgba(15, 17, 23, 0.7));
}

/* 推荐问题行 */
.suggest-row {
  max-width: 860px;
  margin: 0 auto 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggest-chips {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.suggest-chips::-webkit-scrollbar {
  display: none;
}

.suggest-chip {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  transition: all 0.15s;
}

.suggest-chip:hover {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent-soft);
}

.suggest-refresh {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  transition: color 0.2s, border-color 0.2s, transform 0.3s;
}

.suggest-refresh:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: rotate(90deg);
}

.input-box {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 10px 10px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  max-height: 180px;
  font-size: calc(var(--font-base, 15px) - 0.5px);
  line-height: 1.6;
  /* 上下内边距：让单行文字与发送按钮垂直居中贴合 */
  padding: 7px 0;
}

.input::placeholder {
  color: var(--text-faint);
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  transition: background 0.15s, opacity 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.toolbar {
  max-width: 860px;
  margin: 8px auto 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
}

.web-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: all 0.15s;
}

.web-btn:hover {
  color: var(--text);
  border-color: #3a4057;
}

.web-btn.on {
  color: #fff;
  background: linear-gradient(
    135deg,
    rgba(124, 108, 255, 0.3),
    rgba(78, 161, 255, 0.3)
  );
  border-color: var(--accent);
  animation: breath 2s ease-in-out infinite;
}

.web-btn .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-faint);
  transition: background 0.15s, box-shadow 0.15s;
}

.web-btn.on .dot {
  background: var(--accent);
  animation: dot-breath 2s ease-in-out infinite;
}

/* 开启时呼吸光晕 */
@keyframes breath {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(124, 108, 255, 0.35);
  }
  50% {
    box-shadow: 0 0 16px rgba(124, 108, 255, 0.75);
  }
}

@keyframes dot-breath {
  0%,
  100% {
    opacity: 0.7;
    box-shadow: 0 0 4px var(--accent);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 12px var(--accent);
  }
}

.model-select {
  margin-left: auto;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  outline: none;
  cursor: pointer;
}

.model-select:focus {
  border-color: var(--accent);
}

.hint {
  max-width: 860px;
  margin: 8px auto 0;
  font-size: 11.5px;
  color: var(--text-faint);
  text-align: center;
}

/* 手机端：输入区收紧，隐藏提示文字 */
@media (max-width: 768px) {
  .input-area {
    padding: 10px 12px 14px;
  }

  .hint {
    display: none;
  }

  .toolbar {
    margin-top: 6px;
  }

  .suggest-chip {
    padding: 5px 10px;
    font-size: 12px;
  }
}
</style>
