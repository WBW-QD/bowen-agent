# Bowen Agent · 全能 AI Chat

一个"有问必答"的全能 AI 对话前端模板，部署本地大模型即可变为多功能 AI 聊天应用。对标（NextChat、LobeChat、Open WebUI 等）的设计与架构，基于 **Vue 3 + Vite** 从零构建。

> 愿景：打造一个界面友好、支持流式输出、多轮对话、可扩展知识检索的全能 AI 助手。

**🌐 在线演示**（GitHub Pages 仅托管前端）：[https://WBW-QD.github.io/bowen-agent](https://WBW-QD.github.io/bowen-agent) — 检测不到后端时自动进入**在线演示模式**（预设问答 + 浏览器实时时间）。

---

## 贡献者 / Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/WBW-QD">
        <img src="https://github.com/WBW-QD.png" width="60" height="60" style="border-radius:50%" />
        <br />
        <b>WBW-QD</b>
      </a>
      <br />
      作者 · Creator
    </td>
  </tr>
</table>

---

## 一、功能总览

### 💬 对话体验
- [x] 聊天主界面：左侧会话侧边栏 + 右侧消息流 + 底部输入区
- [x] 流式输出（打字机效果）：SSE 逐段渲染
- [x] 多轮上下文对话（携带完整历史，模型记得上文）
- [x] 思考中动画（三点闪烁）· 联网时显示「🔍 正在联网搜索…」
- [x] 生成中锁定发送 · 出错提示
- [x] 首条消息自动作为会话标题 · 自动滚动到底部

### 🗂️ 会话管理
- [x] 新建 / 切换 / 删除会话
- [x] **回收站**：删除先进回收站（软删除），可恢复、可彻底删除
- [x] **localStorage 自动持久化**：会话、回收站、当前会话，刷新不丢
- [x] 始终保持至少一个会话

### 🧠 AI 技能
- [x] **长期记忆体**：对 AI 说「记住：xxx」即存入长期记忆，之后每次问答自动注入；顶栏 🧠 徽标显示记忆数量，可点开面板逐条删除
- [x] **联网搜索**（开关 + 顶栏 🌐 徽标 + 呼吸光效）：默认免 Key 多引擎链 **百度 → 搜狗 → 必应cn**（国内可访问），全部失败回退 DuckDuckGo / Wikipedia；可配 Bing 官方 API
- [x] **情感识别**：中文关键词 + 标点启发式检测 7 种情绪（紧急 ⚠️ / 生气 😠 / 难过 😢 / 焦虑 😰 / 疲惫 😪 / 开心 😄 / 感谢 🙏）+ 强度，顶栏显示 emoji 徽标，后端按情绪注入回应语气
- [x] **时间感知**：后端注入当前日期时间，可准确回答"现在几点 / 今天是几号"；按时段 35% 概率带一句关心话（深夜 / 清晨 / 午间 / 傍晚 / 晚间话术库随机抽取）
- [x] **多模型切换**：`/api/models` 动态加载已装模型下拉选择
- [x] 联网状态由后端按开关显式声明，杜绝模型"乱答是否联网"

### 🎨 界面与个性化
- [x] 暗色主题 + **5 种主题色**（主题紫 / 天空蓝 / 翡翠绿 / 活力橙 / 玫瑰红），CSS 变量全局染色，气泡同步变色
- [x] **字体大小**：小 / 中 / 大
- [x] **中英双语**（界面文案 + AI 应答 + 推荐问题）
- [x] **推荐问题** chips：随机生成一轮（含"询问信息"类问题）+ 🔄 换一批
- [x] 欢迎页：圆形 Agent 图标 + 渐变大字「有什么我能帮你的吗？」+ 漂浮动画
- [x] 背景 logo：空会话清晰铺满 + 边缘淡出，进入对话后整体模糊（0.6s 平滑过渡）
- [x] 玻璃拟态消息气泡（半透明 + 渐变 + 模糊 + 投影）
- [x] 点击 AI 头像 / 欢迎 logo / 用户头像查看大图（ImageViewer 全屏弹窗）
- [x] **移动端适配**：侧边栏变抽屉 + 汉堡菜单 + 遮罩，输入区/顶栏响应式收紧

### 🧪 在线演示模式
- [x] 后端不可达 → 自动进入演示模式（顶栏 🧪 徽标）
- [x] 预设问答库覆盖全部推荐问题（中英双语，时间 / 日期按浏览器实时）
- [x] 首次进入弹提醒（仅弹一次，sessionStorage 记录）
- [x] 真实请求失败时自动回退演示回答

---

## 二、技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 前端框架 | Vue 3（Composition API · `<script setup>`） | 组合式 API，逻辑复用清晰 |
| 构建工具 | Vite 8 + @vitejs/plugin-vue | `@` → `src`；`base: './'` 适配 GitHub Pages 子路径 |
| 状态管理 | 集中式（App.vue + props / emit / defineModel） | 不引入 Pinia，保持轻量可控 |
| 路由 | 侧边栏视图切换（对话 / 历史 / 回收站） | 单页应用，不引入 Vue Router |
| Markdown | 气泡 `white-space: pre-wrap` 纯文本渲染 | 未引入 marked / highlight.js，保持轻量 |
| 国际化 | 手写极简 i18n（`src/i18n.js`） | 中英字典 + 共享语言状态 |
| UI 样式 | 原生 CSS + CSS 变量 | 暗色主题 + 主题色动态染色，不引入 UI 库 |
| 后端 | Node.js + Express 5 + SSE | 流式转发，隐藏模型细节 |
| 联网搜索 | 手写多引擎抓取（百度 / 搜狗 / 必应cn / DuckDuckGo / Wikipedia） | 免 Key；可配 Bing 官方 API |
| 持久化 | localStorage | 会话 / 回收站 / 记忆 / 主题 / 字体 / 语言 |
| 启动 | concurrently 合并 | `npm run dev` 一条命令同时启动前端 + 后端 |
| 部署 | GitHub Actions → GitHub Pages | 推 main 自动构建部署 |

> 💡 **设计取向**：除 `vue` + `express` 两个运行时依赖外，状态、路由、i18n、Markdown、搜索抓取全部零依赖手写 —— 全部源码可见、可控、可学。

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────┐
│              浏览器 (Vue 3)  Bowen Agent            │
│  会话侧边栏(对话/历史/回收站) · 消息流 · 输入区      │
│  🧠 长期记忆 · 🌐 联网开关 · 🎨 主题/字体/语言       │
│        （后端不可达 → 自动切在线演示模式）           │
└───────────────────────┬─────────────────────────────┘
                        │  POST /api/chat (SSE 流式)
┌───────────────────────┴─────────────────────────────┐
│        后端 API 代理 (Node / Express) :3000          │
│   /api/health 健康检查 · /api/models 模型列表        │
│   拼接历史 + 系统提示词 + 长期记忆 + 情感语气 + 时间 │
│   ├─ 联网开关开 → 多引擎搜索 → 结果注入上下文        │
│   └─ 流式转发 Ollama → SSE 逐段吐给前端              │
└───────────────────────┬─────────────────────────────┘
                        │  Streaming API
┌───────────────────────┴─────────────────────────────┐
│         LLM：本地 Ollama（可换 Claude / OpenAI）     │
│         keep_alive 30m + num_ctx 4096（常驻提速）    │
└─────────────────────────────────────────────────────┘
```

**一次对话的完整流程**：
1. 用户在输入框提问（可开启联网 / 切换模型），前端把消息加入会话
2. 前端 `fetch('/api/chat')` 携带 `对话历史 + 系统提示词 + 长期记忆 + 模型 + 联网开关`
3. 后端检测情绪、注入当前时间、按时段生成关心话；开启联网则先去多引擎搜索，把结果注入为上下文
4. 调用 Ollama 流式接口 → SSE（`text/event-stream`）逐段转发
5. 前端解析流，实时渲染成"打字机"效果；情绪标签先行推送显示在顶栏
6. 一轮结束，完整内容落 localStorage（会话 / 消息自动保存）

---

## 四、快速开始

```sh
npm install
npm run dev        # 一条命令同时启动 前端 Vite（:5173）+ 后端 Express（:3000）
```
> 已用 `concurrently` 合并：`npm run dev` = `npm run web` + `npm run server`（Ctrl+C 同时停两个）。旧的后端仍可单独用 `npm run server` 启动；端口 5173 被占用时 Vite 会自动换 5174。

**首选方案：本地 Ollama（免费、离线、无需 API Key）**

先装好 [Ollama](https://ollama.com/) 并拉取一个模型：
```bash
ollama pull qwen2.5:7b        # 或其他已支持的模型，如 llama3.1
ollama serve                  # 启动服务（默认 :11434）
```

后端默认连本地 Ollama，几乎零配置：
```bash
# server/.env（可留空，使用默认值）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

> 以后想升级为云端模型，只需在 `server/.env` 里加：
> ```bash
> # ANTHROPIC_API_KEY=sk-xxx    # Claude
> # OPENAI_API_KEY=sk-xxx       # OpenAI
> ```
> 后端接口保持一致，前端不用动。

---

## 五、配置说明（server/.env）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | 默认对话模型 |
| `PORT` | `3000` | 后端端口 |
| `SEARCH_PROVIDER` | `baidu` | 联网搜索主引擎：`baidu` / `sogou` / `bing` |
| `SEARCH_API_KEY` | 空 | Bing 官方 API Key（设置后走 `bing` 官方接口） |

联网搜索默认**免 Key**：主引擎失败自动切换下一个，最后兜底 DuckDuckGo / Wikipedia，全程国内可访问。

---

## 六、目录结构

```
vue-AI-project
├─ index.html
├─ vite.config.js            # 相对路径 base + /api 代理 → :3000
├─ package.json              # concurrently 合并启动
├─ .github/workflows/deploy.yml   # 推 main 自动部署 GitHub Pages
├─ server/                   # 后端代理（Node + Express）
│  ├─ index.js               # 入口：health / models / chat，生产托管 dist/
│  ├─ chat.js                # /api/chat 流式转发（情绪/时间/联网注入）
│  ├─ search.js              # 多引擎联网搜索（百度/搜狗/必应cn/DDG/Wiki）
│  ├─ emotion.js             # 情感识别（关键词 + 标点启发式）
│  ├─ phrases.js             # 按时段关心话术库
│  └─ .env.example           # 环境变量示例
└─ src/
   ├─ main.js
   ├─ App.vue                # 根组件：会话/回收站/记忆/演示模式 全部逻辑
   ├─ i18n.js                # 手写中英字典 + 语言状态
   ├─ api/
   │  └─ chat.js             # SSE 流式客户端（fetch + ReadableStream）
   ├─ assets/                # AIagent.png / logo.png / photo.jpg
   ├─ components/
   │  ├─ Sidebar.vue         # 会话侧边栏（对话/历史/回收站 + 设置面板）
   │  ├─ MessageList.vue     # 消息流 + logo 背景 + 欢迎页
   │  ├─ MessageItem.vue     # 单条消息气泡（思考/联网动画）
   │  ├─ ChatInput.vue       # 推荐问题 + 输入框 + 联网开关 + 模型下拉
   │  └─ ImageViewer.vue     # 通用大图查看弹窗
   └─ styles/
      └─ main.css            # 全局样式 / 主题 CSS 变量
```

---

## 七、部署

**GitHub Pages（在线演示，只含前端）**
推送到 `main` 后 `.github/workflows/deploy.yml` 自动构建并部署到 Pages —— 无后端时自动进入**在线演示模式**。

**生产模式（本地完整运行）**
```sh
npm run build        # 构建前端到 dist/
npm run server       # Express 自动托管 dist/，访问 http://localhost:3000 即整个应用
```

---

## 八、Roadmap

**✅ 已完成**
- [x] Phase 0 · 环境准备：Vite + Vue 3 脚手架
- [x] Phase 1 · 静态 UI 骨架：三大区域定稿 + 视觉方案（logo 背景模糊、玻璃气泡、暗色主题）
- [x] Phase 2 · 后端代理：Express + SSE 流式，健康检查
- [x] Phase 3 · 前后端打通：流式打字机 + 多轮上下文 + 出错处理
- [x] Phase 4 · 会话管理：localStorage 持久化 + 回收站 + 记忆体
- [x] Phase 5 · 全知全能：多模型 / 联网搜索 / 情感识别 / 时间感知 / 中英双语 / 主题定制 / 演示模式 / 移动端

**🔜 规划中**
- [ ] Markdown 渲染 + 代码高亮（当前为纯文本，可平滑接入 marked / markdown-it）
- [ ] 系统 Prompt / 角色设定管理（目前为固定常量）
- [ ] 知识库 / RAG（上传文档，针对私有资料问答）
- [ ] 导出对话、分享链接

---

## 九、为什么这样设计

1. **前端只负责 UI，不接触 Key** —— 安全，也是所有高 Star 模板的共识
2. **先静态后动态** —— Phase 1 用假数据把界面做美，再接入真实模型，问题更容易定位
3. **流式是 AI 聊天体验的灵魂** —— 从第一版就支持，否则体验大打折扣
4. **会话是骨架** —— 会话管理、持久化做扎实，后面接 RAG、多模型都是插拔
5. **零依赖手写** —— 状态、i18n、搜索抓取全部自研，源码可控可学，便于二次开发

---

## 十、参考

- **Bug / 修复记录**：[BUGS.md](BUGS.md)（BUG-001 ~ BUG-011，含根因与经验教训）
- **高 Star 模板**：NextChat / LobeChat / Open WebUI / Vercel AI Chatbot —— 前端 UI ⇄ 后端 API 代理 ⇄ LLM 的统一范式
