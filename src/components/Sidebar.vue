<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import aiAgentImg from '@/assets/AIagent.png'
import photoImg from '@/assets/photo.jpg'
import ImageViewer from './ImageViewer.vue'
import { lang, setLang, t } from '../i18n.js'

defineProps({
  sessions: { type: Array, default: () => [] },
  activeId: { type: [String, Number], default: null },
  trash: { type: Array, default: () => [] },
  view: { type: String, default: 'chat' }, // chat | history | trash
  open: { type: Boolean, default: false }, // 手机端抽屉是否展开
})

const emit = defineEmits([
  'select',
  'create',
  'remove',
  'restore',
  'permanent-delete',
  'view-change',
])

// ===== 设置面板与用户信息 =====
const settingsOpen = ref(false)
const viewAvatar = ref(false)
const avatarError = ref(false)
const accent = ref('#7c6cff')
const fontSize = ref(15)

const FONT_SIZES = [
  { key: 'fontS', value: 14 },
  { key: 'fontM', value: 15 },
  { key: 'fontL', value: 16 },
]

// 主题色预设
const THEMES = [
  { name: '主题紫', color: '#7c6cff' },
  { name: '天空蓝', color: '#4ea1ff' },
  { name: '翡翠绿', color: '#30a46c' },
  { name: '活力橙', color: '#f76b15' },
  { name: '玫瑰红', color: '#e5484d' },
]

// 关于 Bowen Agent 的基本信息
const ABOUT = [
  { label: '名称', value: 'Bowen Agent' },
  { label: '创造者', value: 'Bowen' },
  { label: '创建时间', value: '2026年8月19日凌晨' },
  { label: '前端', value: 'Vue 3 + Vite' },
  { label: '后端', value: 'Node.js + Express' },
  { label: '架构', value: '前端 ↔ 后端 ↔ 本地 Ollama' },
  { label: '模型', value: 'qwen2.5:7b（本地 Ollama）' },
  { label: '能力', value: '联网搜索 / 情感识别 / 长期记忆 / 回收站' },
]

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbStr([r, g, b]) {
  return `rgb(${r},${g},${b})`
}

// 混合两个 RGB 颜色，t 为第二色的比例
function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

// 应用主题色：改写全局 CSS 变量，并给侧边栏/面板/边框/气泡染色（主背景保持不动）
function applyAccent(hex) {
  // 防御：非法颜色直接跳过，避免弄坏背景
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
  accent.value = hex
  localStorage.setItem('bowen-accent', hex)
  const acc = hexToRgb(hex)
  const d = document.documentElement.style

  d.setProperty('--accent', hex)
  d.setProperty('--accent-hover', rgbStr(mixRgb(acc, [255, 255, 255], 0.15)))
  d.setProperty('--accent-soft', `rgba(${acc[0]},${acc[1]},${acc[2]},0.14)`)

  // 侧边栏 / 面板 / 边框 用主题色染色；主聊天背景 --bg 不染
  d.setProperty('--bg-sidebar', rgbStr(mixRgb(hexToRgb('#171a22'), acc, 0.12)))
  d.setProperty('--bg-elevated', rgbStr(mixRgb(hexToRgb('#1f2330'), acc, 0.14)))
  d.setProperty('--bg-hover', rgbStr(mixRgb(hexToRgb('#262b3a'), acc, 0.18)))
  d.setProperty('--border', rgbStr(mixRgb(hexToRgb('#2a2f3d'), acc, 0.25)))

  // 气泡染色
  const [ar1, ag1, ab1] = mixRgb(hexToRgb('#252939'), acc, 0.18)
  const [ar2, ag2, ab2] = mixRgb(hexToRgb('#1a1e2b'), acc, 0.18)
  const [ur1, ug1, ub1] = mixRgb(hexToRgb('#3c435e'), acc, 0.18)
  const [ur2, ug2, ub2] = mixRgb(hexToRgb('#30364e'), acc, 0.18)
  d.setProperty('--bubble-ai-top', `rgba(${ar1},${ag1},${ab1},0.9)`)
  d.setProperty('--bubble-ai-bottom', `rgba(${ar2},${ag2},${ab2},0.9)`)
  d.setProperty('--bubble-user-top', `rgba(${ur1},${ug1},${ub1},0.9)`)
  d.setProperty('--bubble-user-bottom', `rgba(${ur2},${ug2},${ub2},0.9)`)
}

// 应用基础字体大小：改写 --font-base
function applyFontSize(v) {
  fontSize.value = v
  localStorage.setItem('bowen-font-size', String(v))
  document.documentElement.style.setProperty('--font-base', `${v}px`)
}

// 点击面板外部时关闭设置
const sideFooterRef = ref(null)

function onClickOutside(e) {
  if (settingsOpen.value && sideFooterRef.value && !sideFooterRef.value.contains(e.target)) {
    settingsOpen.value = false
  }
}

onMounted(() => {
  const saved = localStorage.getItem('bowen-accent')
  if (saved) applyAccent(saved)
  const savedFont = Number(localStorage.getItem('bowen-font-size'))
  if (savedFont) applyFontSize(savedFont)
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="sidebar-header">
      <div class="brand">
        <img class="brand-logo" :src="aiAgentImg" alt="Bowen Agent" />
        <span class="brand-name">Bowen Agent</span>
      </div>
      <button class="new-btn" title="新建对话" @click="emit('create')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>{{ t('newChat') }}</span>
      </button>
    </div>

    <nav class="session-list">
      <!-- 对话 -->
      <template v-if="view === 'chat'">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === activeId }"
          role="button"
          tabindex="0"
          @click="emit('select', s.id)"
          @keydown.enter="emit('select', s.id)"
          @keydown.space.prevent="emit('select', s.id)"
        >
          <span class="session-title">{{ s.title }}</span>
          <button class="remove-btn" title="移到回收站" @click.stop="emit('remove', s.id)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
            </svg>
          </button>
        </div>
        <p v-if="!sessions.length" class="empty-tip">{{ t('noSessions') }}</p>
      </template>

      <!-- 历史 -->
      <template v-else-if="view === 'history'">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === activeId }"
          role="button"
          tabindex="0"
          @click="emit('select', s.id)"
          @keydown.enter="emit('select', s.id)"
        >
          <span class="session-title">{{ s.title }}</span>
          <span v-if="s.id === activeId" class="tag-current">{{ t('current') }}</span>
        </div>
        <p v-if="!sessions.length" class="empty-tip">{{ t('noHistory') }}</p>
      </template>

      <!-- 回收站 -->
      <template v-else>
        <div v-for="s in trash" :key="s.id" class="session-item trash-item">
          <span class="session-title trash-title">{{ s.title }}</span>
          <button class="act-btn" title="恢复" @click="emit('restore', s.id)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          <button class="act-btn danger" title="彻底删除" @click="emit('permanent-delete', s.id)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p v-if="!trash.length" class="empty-tip">{{ t('trashEmpty') }}</p>
      </template>
    </nav>

    <!-- 用户信息（头像 + 名字 + 设置齿轮） -->
    <div ref="sideFooterRef" class="side-footer">
      <div class="user-info">
        <div class="user-avatar-wrap" @click="viewAvatar = true">
          <span class="user-avatar-fallback">B</span>
          <img v-if="!avatarError" class="user-avatar" :src="photoImg" alt="Bowen" @error="avatarError = true" />
        </div>
        <span class="user-name">Bowen</span>
        <button class="gear-btn" :class="{ active: settingsOpen }" :title="t('settings')" @click="settingsOpen = !settingsOpen">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <!-- 设置面板（side-footer 的子元素，向上弹出） -->
      <div v-if="settingsOpen" class="settings-panel">
      <div class="settings-section">
        <p class="settings-title">{{ t('theme') }}</p>
        <div class="color-row">
          <button
            v-for="t in THEMES"
            :key="t.color"
            class="color-dot"
            :class="{ active: accent === t.color }"
            :style="{ background: t.color }"
            :title="t.name"
            @click="applyAccent(t.color)"
          ></button>
        </div>
      </div>
      <div class="settings-section">
        <p class="settings-title">{{ t('font') }}</p>
        <div class="opt-row">
          <button
            v-for="f in FONT_SIZES"
            :key="f.value"
            class="opt-btn"
            :class="{ active: fontSize === f.value }"
            @click="applyFontSize(f.value)"
          >{{ t(f.key) }}</button>
        </div>
      </div>
      <div class="settings-section">
        <p class="settings-title">{{ t('langLabel') }}</p>
        <div class="opt-row">
          <button class="opt-btn" :class="{ active: lang === 'zh' }" @click="setLang('zh')">中文</button>
          <button class="opt-btn" :class="{ active: lang === 'en' }" @click="setLang('en')">English</button>
        </div>
      </div>
      <div class="settings-section">
        <p class="settings-title">{{ t('about') }}</p>
        <div class="about-list">
          <div v-for="item in ABOUT" :key="item.label" class="about-item">
            <span class="about-label">{{ item.label }}</span>
            <span class="about-value">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- 底部导航：对话 / 历史 / 回收站 -->
    <nav class="bottom-nav">
      <button class="nav-item" :class="{ active: view === 'chat' }" @click="emit('view-change', 'chat')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('chat') }}</span>
      </button>
      <button class="nav-item" :class="{ active: view === 'history' }" @click="emit('view-change', 'history')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
          <path d="M3.5 7A9 9 0 0 1 18 4.6" />
        </svg>
        <span>{{ t('history') }}</span>
      </button>
      <button class="nav-item" :class="{ active: view === 'trash' }" @click="emit('view-change', 'trash')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
        </svg>
        <span>{{ t('trash') }}</span>
      </button>
    </nav>

    <!-- 头像大图：点击头像查看 -->
    <ImageViewer :src="photoImg" alt="Bowen" v-model:open="viewAvatar" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  position: relative;
  /* 建立层叠上下文：让设置面板等浮层压过主区 */
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
}

.sidebar-header {
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
}

.brand-name {
  font-weight: 600;
  letter-spacing: 0.2px;
}

.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-size: 13.5px;
  font-weight: 500;
  transition: background 0.15s;
}

.new-btn:hover {
  background: var(--accent-hover);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.session-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.session-item:hover {
  background: var(--bg-hover);
}

.session-item.active {
  background: var(--accent-soft);
  color: #fff;
}

.session-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13.5px;
}

.tag-current {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--accent);
  border: 1px solid var(--accent);
}

/* 移到回收站按钮（对话视图） */
.remove-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.session-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(229, 72, 77, 0.16);
  color: var(--danger);
}

/* 回收站操作按钮 */
.act-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}

.act-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.act-btn.danger:hover {
  background: rgba(229, 72, 77, 0.16);
  color: var(--danger);
}

.trash-item {
  cursor: default;
}

.trash-title {
  color: var(--text-muted);
}

.empty-tip {
  padding: 16px 10px;
  font-size: 12.5px;
  color: var(--text-faint);
  text-align: center;
}

/* ===== 底部：设置 + 用户信息 ===== */
.side-footer {
  position: relative;
  flex-shrink: 0;
  padding: 8px 10px 8px;
  border-top: 1px solid var(--border);
}

.gear-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-left: auto;
  border-radius: 8px;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}

.gear-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.gear-btn.active {
  color: var(--accent);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px 2px;
}

.user-avatar-wrap {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.user-avatar-wrap:hover {
  box-shadow: 0 0 12px var(--accent-soft);
}

.user-avatar-fallback {
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.user-avatar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

/* ===== 设置面板 ===== */
.settings-panel {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 8px;
  right: 8px;
  z-index: 60;
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}

.settings-section {
  margin-bottom: 14px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.color-row {
  display: flex;
  gap: 10px;
}

.opt-row {
  display: flex;
  gap: 8px;
}

.opt-btn {
  flex: 1;
  padding: 6px 0;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--bg);
  transition: all 0.15s;
}

.opt-btn:hover {
  color: var(--text);
  border-color: #3a4057;
}

.opt-btn.active {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent-soft);
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: transform 0.15s, border-color 0.15s;
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-dot.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--bg);
}

.about-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.about-item {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
}

.about-label {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 56px;
}

.about-value {
  color: var(--text);
  flex: 1;
  word-break: break-word;
}


/* 底部导航 */
.bottom-nav {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid var(--border);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 4px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-soft);
  color: #fff;
}

/* 手机端：侧边栏变为抽屉，默认滑出屏幕，展开时滑入 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    /* 极小屏时抽屉不超屏 */
    width: min(280px, 85vw);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  }

  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
