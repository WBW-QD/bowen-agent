import express from 'express'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { chatStream } from './chat.js'

// 可选加载 server/.env（缺省则用代码里的默认值）
try {
  loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'))
} catch {
  // .env 不存在就忽略，使用默认配置
}

const app = express()
app.use(express.json())

const PORT = Number(process.env.PORT || 3000)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

// 健康检查：确认 Ollama 服务可达
app.get('/api/health', async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/version`)
    const v = await r.json()
    res.json({ ok: true, ollama: v.version })
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message })
  }
})

// 模型列表：给前端下拉框用
app.get('/api/models', async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    const json = await r.json()
    const models = (json.models || []).map((m) => m.name)
    res.json({ ok: true, models })
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message })
  }
})

// 聊天：SSE 流式转发
app.post('/api/chat', chatStream)

// 生产模式：托管前端构建产物（dist/），这样只跑 server 也能访问整个应用
const distDir = path.resolve(fileURLToPath(import.meta.url), '../..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA 回退：非 /api 的路径都返回 index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Bowen Agent 后端已启动：http://localhost:${PORT}`)
  console.log(`Ollama: ${OLLAMA_BASE_URL}`)
})
