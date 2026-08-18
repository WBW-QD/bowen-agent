<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import MessageList from './components/MessageList.vue'
import ChatInput from './components/ChatInput.vue'
import { streamChat } from './api/chat.js'
import { lang, setLang, t, EMOTION_LABELS } from './i18n.js'

// 系统提示词按语言切换（身份信息保持中文，仅应答语言变化）
const SYSTEM_PROMPT = computed(() => {
  const langInstr =
    lang.value === 'en'
      ? 'You are Bowen Agent, an all-knowing AI assistant. Respond in English, naturally and conversationally, warmly, with occasional humor; vary your phrasing each time and avoid being templated or repetitive. '
      : '你是 Bowen Agent，一个全知全能的 AI 助手。回答用简体中文，口语化、自然、像真人聊天，有温度，偶尔带点幽默；同一件事每次换个说法，避免模板化和重复。 '
  return (
    langInstr +
    '你的创造者是 Bowen：他使用 Claude Code（Anthropic 的 AI）创造了你，这是他的第一个 Agent 项目；你创建于 2026 年 8 月 19 日凌晨。' +
    '关于你自己的具体信息（如创建日期、版本、出身细节等），如果系统没有明确提供，就如实回答"我不确定"，绝对不要编造具体的日期、时间或故事细节。' +
    '当且仅当用户明确说"我是Bowen"或"我是你的创造者"时，才用认出造物主的语气回应（表达兴奋、感谢或俏皮感慨）；除非用户明确表明身份，否则不要假定对方是 Bowen，正常地称呼对方、正常回答即可。' +
    '当被问到"你是谁""谁创造了你"时，自然地介绍自己（我是 Bowen Agent，由 Bowen 在 2026 年 8 月 19 日凌晨用 Claude Code 创造，是他的第一个 Agent 项目），每次换个说法，不要一字不差地背同一段。不要反问用户"你的创造者是谁"之类的话。' +
    '回答中不要使用[1]、[2]之类的编号标注。' +
    '当系统提供了"以下是联网搜索到的资料"时，请直接依据这些资料给出明确、确定的答案，避免"可能、大概、也许"等推测性措辞。'
  )
})

const sending = ref(false)
const emotionTag = ref(null) // 当前检测到的情绪 { name, emoji, intensity }
const backendAvailable = ref(true) // 后端是否可达（不可达 → 在线演示模式）
const webSearch = ref(false)
const model = ref('qwen2.5:7b')
const models = ref([])

// 检测后端是否可达（不可达 → 进入在线演示模式）
async function checkBackend() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch('/api/health', { signal: ctrl.signal })
    clearTimeout(timer)
    backendAvailable.value = res.ok
  } catch {
    backendAvailable.value = false
  }
}

// 点击记忆面板外部时关闭
function onMemoryClickOutside(e) {
  if (memoryPanel.value && memoryWrapRef.value && !memoryWrapRef.value.contains(e.target)) {
    memoryPanel.value = false
  }
}

// 加载已安装的模型列表，填充下拉框
onMounted(async () => {
  document.addEventListener('click', onMemoryClickOutside)
  checkBackend()
  try {
    const res = await fetch('/api/models')
    const json = await res.json()
    if (json.ok && json.models?.length) {
      models.value = json.models
      if (!json.models.includes(model.value)) model.value = json.models[0]
    }
  } catch {
    // 后端未启动时静默失败，保留默认模型
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onMemoryClickOutside)
})

// ========== 数据 ==========
let seq = 1 // 会话 id 自增

const STORAGE_SESSIONS = 'bowen-sessions-v1'
const STORAGE_MEMORY = 'bowen-memory-v1'

const sessions = ref([])
const trash = ref([]) // 回收站：删除的会话先进这里（软删除）
const memories = ref([]) // 长期记忆库
const sidebarView = ref('chat') // 侧边栏视图：chat | history | trash
const sidebarOpen = ref(false) // 手机端抽屉是否展开
const memoryPanel = ref(false) // 记忆面板是否展开
const memoryWrapRef = ref(null)
const activeId = ref(null)

// ---- 恢复本地存档（记忆体）----
try {
  const saved = localStorage.getItem(STORAGE_SESSIONS)
  if (saved) {
    const d = JSON.parse(saved)
    sessions.value = d.sessions || []
    trash.value = d.trash || []
    activeId.value = d.activeId ?? null
    seq = Math.max(
      1,
      ...sessions.value.map((s) => s.id),
      ...trash.value.map((s) => s.id),
    )
  }
} catch {
  // 存档损坏则忽略，使用默认
}
try {
  const savedMem = localStorage.getItem(STORAGE_MEMORY)
  if (savedMem) memories.value = JSON.parse(savedMem) || []
} catch {
  // ignore
}

// 确保至少有一个新对话，且 activeId 有效
if (!sessions.value.length) createSession()
if (activeId.value == null || !sessions.value.some((s) => s.id === activeId.value)) {
  activeId.value = sessions.value[0]?.id ?? null
}

// ---- 自动保存：会话变化即写入 localStorage ----
watch(
  [sessions, trash, activeId],
  () => {
    localStorage.setItem(
      STORAGE_SESSIONS,
      JSON.stringify({
        sessions: sessions.value,
        trash: trash.value,
        activeId: activeId.value,
      }),
    )
  },
  { deep: true },
)
watch(
  memories,
  () => {
    localStorage.setItem(STORAGE_MEMORY, JSON.stringify(memories.value))
  },
  { deep: true },
)

const activeSession = computed(
  () => sessions.value.find((s) => s.id === activeId.value) ?? null,
)

// ========== 交互 ==========
function selectSession(id) {
  activeId.value = id
  sidebarView.value = 'chat'
  sidebarOpen.value = false // 手机端选择会话后收起抽屉
}

function createSession() {
  const id = ++seq
  sessions.value.unshift({ id, title: '新对话', messages: [] })
  activeId.value = id
  sidebarView.value = 'chat'
  sidebarOpen.value = false
}

// 删除 → 进回收站（软删除，可恢复）
function removeSession(id) {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  const [removed] = sessions.value.splice(idx, 1)
  trash.value.unshift(removed)
  if (activeId.value === id) {
    activeId.value = sessions.value[0]?.id ?? null
    if (!activeId.value) createSession() // 始终保持至少一个新对话
  }
}

// 从回收站恢复
function restoreSession(id) {
  const idx = trash.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  const [s] = trash.value.splice(idx, 1)
  sessions.value.unshift(s)
  activeId.value = s.id
  sidebarView.value = 'chat'
  sidebarOpen.value = false
}

// 彻底删除（不经过回收站）
function permanentDelete(id) {
  const idx = trash.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  trash.value.splice(idx, 1)
}

function setSidebarView(v) {
  sidebarView.value = v
}

// ========== 记忆体 ==========
// 从消息里解析"记住..."指令，返回要记住的内容
function extractRemember(text) {
  const m = text.match(/(?:请记住|帮我记住|记一下|记住)[:：]?\s*(.+)/)
  return m && m[1].trim() ? m[1].trim() : null
}

function removeMemory(id) {
  memories.value = memories.value.filter((m) => m.id !== id)
}

// ===== 在线演示模式：后端不可用时本地生成回复 =====
function demoReply(content) {
  const now = new Date()
  const wd = '日一二三四五六'[now.getDay()]
  if (/几点|时间|time|现在.{0,2}钟/.test(content)) {
    return `现在是 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}。`
  }
  if (/几号|日期|date|星期/.test(content)) {
    return `今天是 ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日，星期${wd}。`
  }
  if (/你是谁|who are you|介绍/.test(content)) {
    return '我是 Bowen Agent，由 Bowen 在 2026 年 8 月 19 日凌晨用 Claude Code 创造的第一个 Agent 项目。'
  }
  const head =
    lang.value === 'en'
      ? 'This is an online DEMO MODE'
      : '现在是【在线演示模式】'
  return `你问的是「${content.slice(0, 40)}」\n\n${head}：GitHub Pages 上只部署了前端界面，没有后端和 Ollama 模型，所以我先给你一段演示回复。等部署完整后端后，我就能真正回答这个问题了。`
}

// 演示回复：逐字"打字"效果
function demoStream(reply, fullText) {
  emotionTag.value = null
  let i = 0
  const timer = setInterval(() => {
    i += 2
    reply.content = fullText.slice(0, i)
    if (i >= fullText.length) {
      clearInterval(timer)
      reply.content = fullText
    }
  }, 20)
}

async function handleSend(content) {
  if (sending.value) return

  let session = activeSession.value
  // 没有活跃会话时自动新建一个
  if (!session) {
    createSession()
    session = activeSession.value
  }

  // 首条消息作为会话标题
  if (!session.messages.length) {
    session.title = content.slice(0, 20) + (content.length > 20 ? '…' : '')
  }

  session.messages.push({ role: 'user', content })
  sending.value = true

  // 记忆体：解析"记住..."指令，存入长期记忆
  const fact = extractRemember(content)
  if (fact) {
    memories.value.push({
      id: Date.now(),
      content: fact,
      createdAt: new Date().toISOString(),
    })
  }

  // 占位 assistant 消息，流式往里填充
  // 注意：必须用 reactive()，否则直接改 reply.content 不会触发视图更新
  const reply = reactive({ role: 'assistant', content: '' })
  session.messages.push(reply)

  // 在线演示模式：后端不可用时本地生成回复
  if (!backendAvailable.value) {
    demoStream(reply, demoReply(content))
    sending.value = false
    return
  }

  // 上下文：过滤掉空的占位消息，发送完整历史（含本次提问）
  const history = session.messages
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content }))

  // 系统提示词 + 长期记忆注入
  let sys = SYSTEM_PROMPT.value
  if (memories.value.length) {
    sys +=
      '\n\n【长期记忆】用户告诉过你这些事，请记住并在回答中自然运用（除非用户明确要求忘记）：\n- ' +
      memories.value.map((m) => m.content).join('\n- ')
  }

  try {
    await streamChat({
      messages: history,
      system: sys,
      model: model.value,
      webSearch: webSearch.value,
      onEmotion: (emo) => {
        emotionTag.value = emo
      },
      onContent: (chunk) => {
        reply.content += chunk
      },
      onError: (msg) => {
        // 请求失败 → 视为后端不可用，切到演示模式
        backendAvailable.value = false
        if (!reply.content) {
          reply.content = demoReply(history[history.length - 1]?.content || '')
        } else {
          reply.content += `\n\n（出错了：${msg}）`
        }
      },
    })
  } finally {
    sending.value = false
    emotionTag.value = null
  }
}
</script>

<template>
  <div class="layout" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- 手机端抽屉遮罩 -->
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false"></div>

    <Sidebar
      :sessions="sessions"
      :active-id="activeId"
      :trash="trash"
      :view="sidebarView"
      :open="sidebarOpen"
      @select="selectSession"
      @create="createSession"
      @remove="removeSession"
      @restore="restoreSession"
      @permanent-delete="permanentDelete"
      @view-change="setSidebarView"
    />

    <main class="main">
      <header class="topbar">
        <button class="menu-btn" title="菜单" @click="sidebarOpen = !sidebarOpen">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span class="session-title">{{ activeSession?.title ?? 'Bowen Agent' }}</span>
        <div class="topbar-right">
          <!-- 记忆体 -->
          <div ref="memoryWrapRef" class="memory-wrap">
            <button class="memory-badge" :title="t('memory')" @click="memoryPanel = !memoryPanel">
              🧠 {{ memories.length }}
            </button>
            <div v-if="memoryPanel" class="memory-panel">
              <p class="memory-panel-title">{{ t('memory') }}</p>
              <div v-if="memories.length">
                <div v-for="m in memories" :key="m.id" class="memory-item">
                  <span class="memory-text">{{ m.content }}</span>
                  <button class="memory-del" :title="t('memory')" @click="removeMemory(m.id)">✕</button>
                </div>
              </div>
              <p v-else class="memory-empty">{{ t('noMemory') }}</p>
            </div>
          </div>

          <span v-if="emotionTag" class="emo-badge" :title="`${lang === 'en' ? 'Intensity' : '情绪强度'} ${emotionTag.intensity}/10`">
            {{ emotionTag.emoji }} {{ lang === 'en' ? EMOTION_LABELS.en[emotionTag.name] || emotionTag.name : emotionTag.name }}
          </span>
          <span v-if="webSearch" class="web-badge">🌐 {{ t('online') }}</span>
          <span v-if="!backendAvailable" class="demo-badge">🧪 {{ t('demoMode') }}</span>
          <span class="model-tag">{{ sending ? t('generating') : `${model} · ${t('localModel')}` }}</span>
        </div>
      </header>

      <MessageList :messages="activeSession?.messages ?? []" :web-search="webSearch" />

      <ChatInput
        :sending="sending"
        :models="models"
        v-model:webSearch="webSearch"
        v-model:model="model"
        @send="handleSend"
      />
    </main>
  </div>
</template>

<style scoped>
.layout {
  height: 100%;
  display: flex;
  background: var(--bg);
}

.main {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: radial-gradient(
    ellipse 90% 50% at 50% 0%,
    rgba(124, 108, 255, 0.06),
    transparent 70%
  );
}

.topbar {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: relative;
  /* 让顶栏及其下拉面板（记忆面板）压过消息区 */
  z-index: 50;
  background: rgba(15, 17, 23, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.session-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 汉堡菜单按钮：默认隐藏，手机端显示 */
.menu-btn {
  display: none;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 8px;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}

.menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

/* 抽屉遮罩：默认隐藏，手机端显示 */
.sidebar-backdrop {
  display: none;
}

/* ============ 手机端适配 ============ */
@media (max-width: 768px) {
  .menu-btn {
    display: grid;
    margin-right: 8px;
  }

  .topbar {
    padding: 0 10px;
  }

  /* 手机上隐藏模型标签，减少顶栏拥挤 */
  .model-tag {
    display: none;
  }

  /* 手机上徽标更紧凑，避免顶栏溢出 */
  .topbar-right {
    gap: 5px;
  }

  .memory-badge,
  .emo-badge,
  .web-badge {
    padding: 2px 8px;
    font-size: 11px;
  }

  /* 遮罩（侧边栏抽屉样式见 Sidebar.vue） */
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.5);
  }
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-tag {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

/* 记忆体 */
.memory-wrap {
  position: relative;
  flex-shrink: 0;
}

.memory-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  transition: color 0.15s, border-color 0.15s;
}

.memory-badge:hover {
  color: var(--text);
  border-color: var(--accent);
}

.memory-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 260px;
  max-height: 260px;
  overflow-y: auto;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.memory-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.memory-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 13px;
}

.memory-item:hover {
  background: var(--bg-hover);
}

.memory-text {
  flex: 1;
  word-break: break-word;
}

.memory-del {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-faint);
  transition: color 0.15s, background 0.15s;
}

.memory-del:hover {
  color: var(--danger);
  background: rgba(229, 72, 77, 0.16);
}

.memory-empty {
  font-size: 12px;
  color: var(--text-faint);
}

/* 在线演示模式徽标 */
.demo-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  color: #ffd166;
  border: 1px solid rgba(255, 209, 102, 0.5);
  background: rgba(255, 209, 102, 0.1);
}

/* 情绪标签 */
.emo-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  color: var(--text);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

/* 联网开启时的醒目提示 */
.web-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), #4ea1ff);
  box-shadow: 0 0 10px rgba(124, 108, 255, 0.45);
}
</style>
