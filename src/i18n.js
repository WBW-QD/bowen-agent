// 极简 i18n：共享语言状态 + 中英文字典
import { ref } from 'vue'

export const lang = ref(localStorage.getItem('bowen-lang') || 'zh')

export function setLang(l) {
  lang.value = l
  localStorage.setItem('bowen-lang', l)
}

const messages = {
  zh: {
    newChat: '新建对话',
    chat: '对话',
    history: '历史',
    trash: '回收站',
    settings: '设置',
    noSessions: '还没有会话，点上方「新建对话」开始',
    noHistory: '暂无历史会话',
    trashEmpty: '回收站是空的',
    current: '当前',
    theme: '外观主题',
    font: '字体大小',
    langLabel: '语言',
    about: '关于 Bowen Agent',
    generating: '生成中…',
    localModel: '本地模型',
    online: '联网中',
    memory: '长期记忆',
    noMemory: '还没有记忆。试试说「记住：我喜欢喝咖啡」',
    welcome: '有什么我能帮你的吗？',
    inputPlaceholder: '有什么想问的？输入后按 Enter 发送…',
    hint: 'Enter 发送 · Shift + Enter 换行',
    webSearch: '联网搜索',
    refresh: '换一批推荐问题',
    fontS: '小',
    fontM: '中',
    fontL: '大',
    demoMode: '演示模式',
    demoTitle: '在线演示模式',
    demoDesc1: '当前是「在线演示模式」——GitHub Pages 只部署了前端界面，没有后端和 Ollama 模型。',
    demoDesc2: '演示模式下提供预设问答；部署完整后端后，即可体验真实的 AI 对话、联网搜索等功能。',
    demoGotIt: '我知道了',
  },
  en: {
    newChat: 'New Chat',
    chat: 'Chat',
    history: 'History',
    trash: 'Trash',
    settings: 'Settings',
    noSessions: 'No conversations yet. Click "New Chat" to start',
    noHistory: 'No history yet',
    trashEmpty: 'Trash is empty',
    current: 'Current',
    theme: 'Theme',
    font: 'Font Size',
    langLabel: 'Language',
    about: 'About Bowen Agent',
    generating: 'Generating…',
    localModel: 'Local Model',
    online: 'Online',
    memory: 'Memory',
    noMemory: 'No memories yet. Try "remember: I like coffee"',
    welcome: 'How can I help you?',
    inputPlaceholder: 'Ask me anything… Press Enter to send',
    hint: 'Enter to send · Shift+Enter for newline',
    webSearch: 'Web Search',
    refresh: 'Refresh suggestions',
    fontS: 'S',
    fontM: 'M',
    fontL: 'L',
    demoMode: 'Demo Mode',
    demoTitle: 'Online Demo Mode',
    demoDesc1: 'You’re in "Demo Mode" — GitHub Pages hosts only the frontend, with no backend or Ollama model.',
    demoDesc2: 'Demo mode provides preset answers. Deploy the full backend to unlock real AI chat, web search, and more.',
    demoGotIt: 'Got it',
  },
}

// 情绪名显示映射（后端返回中文名，界面显示时按语言转换）
export const EMOTION_LABELS = {
  en: {
    紧急: 'Urgent',
    生气: 'Angry',
    难过: 'Sad',
    焦虑: 'Anxious',
    疲惫: 'Tired',
    开心: 'Happy',
    感谢: 'Grateful',
    平静: 'Calm',
  },
}

export function t(key) {
  const dict = messages[lang.value] || messages.zh
  return dict[key] ?? messages.zh[key] ?? key
}
