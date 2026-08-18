# Bowen Agent ·  AI Chat

一个"有问必答"的全能 AI 对话前端，多功能AI 聊天应用（NextChat、LobeChat、Open WebUI 等）的设计与架构，基于 **Vue 3 + Vite** 从零构建。

> 愿景：打造一个界面友好、支持流式输出、多轮对话、可扩展知识检索的全能 AI 助手。

---

## 一、高 Star 模板

| 项目 | Stars | 值得借鉴的点 |
|------|-------|-------------|
| [NextChat / ChatGPT-Next-Web](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web) | ~80k | 极简聊天气泡 + 侧边栏会话管理、流式渲染、Prompt 管理 |
| [LobeChat](https://github.com/lobehub/lobe-chat) | ~60k | 模块化架构、会话/助手/插件体系、响应式布局、视觉设计 |
| [Open WebUI](https://github.com/open-webui/open-webui) | ~50k+ | **同为 Vue 3 技术栈**，Markdown 渲染、多模型切换、RAG 思路 |
| [Vercel AI Chatbot](https://github.com/vercel/ai-chatbot) | ~15k | 优雅的流式 SSE 实现、前端/后端分工的清晰范式 |

**核心借鉴结论**：高 Star 模板几乎都遵循同一个范式 ——

```
前端 UI（Vue/React） ⇄  后端 API 代理  ⇄  LLM 接口（Claude / OpenAI / 本地模型）
```

本项目的后端只做一件事：**隐藏 API Key、转发请求、用流式方式把答案吐给前端**。

---

## 二、技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 前端框架 | Vue 3 (Composition API) | 组合式 API，逻辑复用清晰 |
| 构建工具 | Vite | 已配置好，`@` 指向 `src` |
| 状态管理 | Pinia | 管理会话、消息、全局设置 |
| 路由 | Vue Router | 会话页 / 设置页 |
| UI 样式 | 原生 CSS / UnoCSS | 不引入重型 UI 库，保持轻量可控 |
| Markdown 渲染 | marked / markdown-it | AI 回复是 Markdown，必须渲染 |
| 代码高亮 | highlight.js | 代码块体验 |
| 后端代理 | Node.js (Express) + SSE | 转发请求 + 流式输出 |
| 数据存储 | localStorage（前端）→ 可选 SQLite | 会话持久化 |

---

## 三、系统架构

```
┌─────────────────────────────────────────────┐
│                 浏览器 (Vue 3)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 会话侧边栏 │  │ 消息流列表 │  │ 输入框    │  │
│  └─────┬────┘  └─────┬────┘  └────┬─────┘  │
│        └─────────────┼─────────────┘        │
└──────────────────────┼──────────────────────┘
                       │  POST /api/chat  (SSE 流式)
┌──────────────────────┼──────────────────────┐
│            后端 API 代理 (Node/Express)      │
│     隐藏 Key · 拼接 Prompt · 流式转发        │
└──────────────────────┼──────────────────────┘
                       │   Streaming API
┌──────────────────────┼──────────────────────┐
│        LLM：本地 Ollama · 可换 Claude/OpenAI │
└──────────────────────┴──────────────────────┘
```

**一次对话的完整流程**：
1. 用户在输入框提问，前端把消息加入会话列表
2. 前端 `fetch('/api/chat')` 发起请求，携带 `对话历史 + 当前问题`
3. 后端拼接 Prompt，调用 LLM 的流式接口
4. LLM 逐 token 返回 → 后端通过 SSE（`text/event-stream`）转发
5. 前端读取流，实时把内容渲染成 Markdown，形成"打字机"效果
6. 一轮回答结束，完整内容落库/落 localStorage

---

## 四、核心功能（对标高 Star 模板）

**MVP（第一版）**
- [x] 聊天主界面：左侧会话列表 + 右侧消息流 + 底部输入框（Phase 1 ✅）
- [x] 新建会话、切换会话、删除会话（Phase 1 ✅，本地状态版）
- [x] 流式输出（打字机效果）（Phase 3 ✅，SSE 逐段渲染 + 思考动画）
- [x] 多轮上下文对话（携带历史记录）（Phase 3 ✅，已实测模型记得上文）
- [ ] Markdown 渲染 + 代码高亮 → Phase 5
- [ ] 会话数据持久化（localStorage）→ Phase 4

**全知全能增强（第二版）**
- [x] 多模型切换（本地 Ollama 已装模型下拉切换，`/api/models` 动态列表）
- [x] 联网搜索（默认 cn.bing.com 免 Key，国内可访问；已实测注入搜索结果）
- [ ] 系统 Prompt / 角色设定管理（目前为固定常量，后续可做成可配置）
- [ ] 知识库 / RAG（上传文档，针对私有资料问答）
- [ ] 导出对话、分享链接
- [ ] 移动端适配

> ⚡ **速度优化**：后端请求已带 `keep_alive: 30m` + `num_ctx: 4096`，模型常驻 GPU（本机 RTX 4060，100% GPU 推理），暖机后首 token 约 1 秒。

---

## 五、开发流程（Roadmap）

> 分阶段推进，每步都可在浏览器中看到效果。

### Phase 0 · 环境准备 ✅（已完成）
Vite + Vue 3 脚手架就绪，`npm run dev` 可启动。

### Phase 1 · 静态 UI 骨架 ✅（已完成 · 2026-08-19 定稿）
搭建三大区域：**侧边栏**（会话列表 + 新建按钮）、**消息区**（气泡样式）、**输入区**（文本域 + 发送键）。用假数据渲染界面，先把"好看"做出来。支持新建/删除/切换会话，发送消息会有模拟回复。

**定稿的视觉方案**：
- 背景 logo（`public/logo.png`）：空会话时**清晰铺满 + 边缘淡出**；进入对话后**整体变模糊**（`transition` 0.6s 平滑过渡）
- 欢迎页：圆形 AIagent 图标 + 大号渐变文字「有什么我能帮你的吗？」
- 消息气泡：玻璃质感（半透明 + 渐变 + 模糊 + 投影），用户/AI 两种样式
- 暗色主题 + 主题紫强调色

- 产出：`src/components/Sidebar.vue`、`MessageList.vue`、`MessageItem.vue`、`ChatInput.vue`
- 预览：`npm run dev` 后访问 `http://localhost:5173`

### Phase 2 · 后端代理服务 ✅（已完成）
新建 `server/`，用 Node + Express 写 `/api/chat` 接口：读取环境变量（Ollama 无需 Key），调用 LLM 流式接口，SSE 转发。Vite 代理 `/api` → `:3000` 避免跨域。
- 产出：`server/index.js`、`server/chat.js`、`server/.env.example`
- 验证：`/api/health` 健康检查 + `/api/chat` 流式返回均已实测通过

### Phase 3 · 前后端打通 ✅（已完成）
前端把输入框的提问发给后端，实时渲染流式回答。实现加载状态、思考动画、出错提示、生成中锁定发送。
- 产出：`src/api/chat.js`（fetch + ReadableStream 解析 SSE）
- 验证：端到端（Vite 代理 → Express → Ollama）流式返回成功，多轮上下文实测有效

运行方式：`npm run dev`（前端）+ `npm run server`（后端），浏览器访问 `http://localhost:5173`。

### Phase 4 · 会话管理
Pinia 管理会话/消息状态；localStorage 持久化；支持重命名、删除、切换会话。
- 产出：`src/stores/chat.js`、`src/stores/session.js`

### Phase 5 · 全知全能增强
多模型切换、系统 Prompt 管理、联网搜索（接入搜索 API 后把结果喂给 LLM）、可选 RAG 知识库。
- 产出：`src/stores/settings.js`、`server/search.js`

---

## 六、目标目录结构

```
vue-AI-project
├─ index.html
├─ vite.config.js
├─ package.json
├─ server/                  # 后端代理（Phase 2 起）
│  ├─ index.js              # Express 入口
│  ├─ chat.js               # /api/chat 流式转发
│  └─ .env.example          # API Key 配置示例
└─ src/
   ├─ main.js
   ├─ App.vue               # 根布局（侧边栏 + 主区域）
   ├─ api/
   │  └─ chat.js            # 封装 SSE 请求
   ├─ stores/
   │  ├─ session.js         # 会话列表（Pinia）
   │  └─ chat.js            # 当前会话消息
   ├─ components/
   │  ├─ Sidebar.vue        # 会话侧边栏
   │  ├─ MessageList.vue    # 消息流
   │  ├─ MessageItem.vue    # 单条消息气泡（Markdown）
   │  ├─ ChatInput.vue      # 输入区
   │  └─ Markdown.vue       # Markdown + 代码高亮
   └─ styles/
      └─ main.css           # 全局样式 / 主题变量
```

---

## 七、快速开始

```sh
npm install
npm run dev        # 前端开发服务器 (Vite, 默认 :5173)
npm run server     # 后端代理 (Node, :3000)  ← Phase 2 之后
```

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

## 八、为什么这样设计

1. **前端只负责 UI，不接触 Key** —— 安全，也是所有高 Star 模板的共识
2. **先静态后动态** —— Phase 1 用假数据把界面做美，再接入真实模型，问题更容易定位
3. **流式是 AI 聊天体验的灵魂** —— 必须从第一版就支持，否则体验大打折扣
4. **会话是骨架** —— 会话管理、持久化做扎实，后面接 RAG、多模型都是插拔
