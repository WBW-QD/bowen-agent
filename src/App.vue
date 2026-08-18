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
const showDemoModal = ref(false) // 演示模式提醒弹窗
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
  if (!backendAvailable.value) {
    // 演示模式：弹窗提醒一次
    if (!sessionStorage.getItem('demo-modal-seen')) {
      showDemoModal.value = true
      sessionStorage.setItem('demo-modal-seen', '1')
    }
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
// 预设问答库（覆盖推荐问题池的常见问题，中英双语）
const DEMO_QA = [
  {
    keys: ['你是谁', 'who are you', '怎么出现', 'come to exist', 'exist'],
    zh: '我是 Bowen Agent，由 Bowen 在 2026 年 8 月 19 日凌晨用 Claude Code 创造的第一个 Agent 项目。',
    en: "I'm Bowen Agent, the first agent project created by Bowen with Claude Code in the early morning of Aug 19, 2026.",
  },
  {
    keys: ['创造者', '谁创造', 'created you', 'who created', 'creator'],
    zh: '我的创造者是 Bowen，他用 Claude Code 创造了我，这是他的第一个 Agent 项目。',
    en: 'My creator is Bowen. He built me with Claude Code — his first agent project.',
  },
  {
    keys: ['创建于', '什么时候', 'when'],
    zh: '我创建于 2026 年 8 月 19 日凌晨，是 Bowen 用 Claude Code 做的第一个 Agent 项目。',
    en: 'I was created in the early morning of Aug 19, 2026 — Bowen’s first agent project with Claude Code.',
  },
  {
    keys: ['会做什么', '能力', 'what can you', 'abilities'],
    zh: '我能回答问题、帮你写代码、解释概念、做总结、翻译文本……全知全能，有问必答。',
    en: 'I can answer questions, write code, explain concepts, summarize, translate… basically anything. Just ask!',
  },
  {
    keys: ['联网', 'online', '搜索'],
    zh: '完整部署下我可以联网搜索（百度/搜狗/必应）。现在是演示模式，联网需要后端支持。',
    en: 'When fully deployed I can search the web (Baidu/Sogou/Bing). In this demo mode, that needs the backend.',
  },
  {
    keys: ['记忆', 'memory', '记住'],
    zh: '我有长期记忆功能：你对我说「记住：xxx」，我就会一直记住。',
    en: 'I have long-term memory: tell me "remember: xxx" and I’ll keep it in mind.',
  },
  {
    keys: ['计数器', 'counter'],
    zh: 'Vue 3 计数器：\n\n```vue\n<script setup>\nimport { ref } from "vue"\nconst count = ref(0)\n<\/script>\n\n<template>\n  <button @click="count++">点击了 {{ count }} 次</button>\n<\/template>\n```',
    en: 'Vue 3 counter:\n\n```vue\n<script setup>\nimport { ref } from "vue"\nconst count = ref(0)\n<\/script>\n\n<template>\n  <button @click="count++">Clicked {{ count }} times</button>\n<\/template>\n```',
  },
  {
    keys: ['vue'],
    zh: 'Vue 3 是最流行的渐进式前端框架之一，组合式 API 让逻辑复用更清晰，配合 Vite 开发体验极佳。',
    en: 'Vue 3 is one of the most popular progressive frontend frameworks, with a clean Composition API and great DX with Vite.',
  },
  {
    keys: ['冒泡', 'bubble', 'python'],
    zh: 'Python 冒泡排序：\n\n```python\ndef bubble_sort(arr):\n    n = len(arr)\n    for i in range(n - 1):\n        for j in range(n - 1 - i):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr\n```',
    en: 'Python bubble sort:\n\n```python\ndef bubble_sort(arr):\n    n = len(arr)\n    for i in range(n - 1):\n        for j in range(n - 1 - i):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr\n```',
  },
  {
    keys: ['大语言模型', 'llm', 'large language'],
    zh: '大语言模型（LLM）是通过海量文本训练的深度学习模型，能理解和生成自然语言。常见的有 GPT、Claude、Qwen 等。',
    en: 'A Large Language Model (LLM) is a deep-learning model trained on massive text that understands and generates natural language.',
  },
  {
    keys: ['冷笑话', '笑话', 'joke'],
    zh: '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。🎃',
    en: 'Why do programmers confuse Halloween and Christmas? Because Oct 31 == Dec 25. 🎃',
  },
  {
    keys: ['编程', 'programming', 'learn to code'],
    zh: '快速学会编程：①选一门语言（Python 或 JS）②做一个小项目 ③每天写一点。实践比看教程快得多。',
    en: 'Learn to code fast: ① pick a language (Python or JS) ② build a small project ③ code a little daily. Practice beats tutorials.',
  },
  {
    keys: ['rag'],
    zh: 'RAG（检索增强生成）：先从知识库检索相关资料，再让模型基于资料回答，能减少幻觉、回答私有知识。',
    en: 'RAG (Retrieval-Augmented Generation): retrieve relevant documents first, then answer based on them — less hallucination, handles private knowledge.',
  },
  {
    keys: ['前端项目', 'frontend'],
    zh: '规划前端项目：①明确需求与页面 ②选技术栈 ③设计组件/状态 ④分阶段开发（静态→数据→联调）。',
    en: 'Plan a frontend project: ① clarify requirements ② pick a stack ③ design components/state ④ build in phases.',
  },
  {
    keys: ['量子计算', 'quantum'],
    zh: '量子计算利用量子比特的叠加和纠缠做并行计算，在因数分解、分子模拟等问题上远超经典计算机。',
    en: 'Quantum computing uses superposition and entanglement to solve problems like factoring and molecular simulation far faster.',
  },
  {
    keys: ['2026', '新闻', '事件', 'news'],
    zh: '这是演示模式，无法获取 2026 年的实时新闻。部署完整后端并开启联网后，我就能搜索最新资讯了。',
    en: 'This is demo mode, so I can’t fetch 2026 news. Once the full backend + web search is deployed, I can look it up.',
  },
  {
    keys: ['周末', 'weekend'],
    zh: '周末推荐：去户外走走、读本书、做顿好吃的、学点新技能…… 或者找我聊聊天 😄',
    en: 'Weekend ideas: go outside, read a book, cook something nice, learn a new skill… or chat with me 😄',
  },
  {
    keys: ['书', 'book'],
    zh: '推荐《AIGC：智能创作时代》或《这就是ChatGPT》，都是了解 AI 的好入门书。',
    en: 'I’d recommend "AI 2041" or "A Brief History of Intelligence" as great AI reads.',
  },
]

// 演示回复：时间/日期按浏览器当前时间，其余命中预设问答库
function demoReply(content) {
  const now = new Date()
  const wd = '日一二三四五六'[now.getDay()]
  if (/几点|时间|time/.test(content)) {
    return `现在是 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}。`
  }
  if (/几号|日期|date|星期/.test(content)) {
    return `今天是 ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日，星期${wd}。`
  }
  const q = content.toLowerCase()
  for (const qa of DEMO_QA) {
    if (qa.keys.some((k) => q.includes(k))) {
      return lang.value === 'en' ? qa.en : qa.zh
    }
  }
  const head =
    lang.value === 'en'
      ? 'This is an online DEMO MODE'
      : '现在是【在线演示模式】'
  return `你问的是「${content.slice(0, 40)}」\n\n${head}：GitHub Pages 上只部署了前端界面，没有后端和 Ollama 模型。部署完整后端后，我就能真正回答这个问题了。`
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

  <!-- 演示模式提醒弹窗 -->
  <Teleport to="body">
    <div v-if="showDemoModal" class="demo-modal" @click.self="showDemoModal = false">
      <div class="demo-modal-card">
        <div class="demo-modal-icon">🧪</div>
        <h3 class="demo-modal-title">{{ t('demoTitle') }}</h3>
        <p class="demo-modal-desc">{{ t('demoDesc1') }}</p>
        <p class="demo-modal-desc">{{ t('demoDesc2') }}</p>
        <button class="demo-modal-btn" @click="showDemoModal = false">{{ t('demoGotIt') }}</button>
      </div>
    </div>
  </Teleport>
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

/* 演示模式提醒弹窗 */
.demo-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.7);
  display: grid;
  place-items: center;
  padding: 24px;
}

.demo-modal-card {
  max-width: 380px;
  width: 100%;
  padding: 28px 24px;
  border-radius: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  text-align: center;
}

.demo-modal-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.demo-modal-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #ffd166;
}

.demo-modal-desc {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 8px;
}

.demo-modal-btn {
  margin-top: 14px;
  padding: 9px 28px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s;
}

.demo-modal-btn:hover {
  background: var(--accent-hover);
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
