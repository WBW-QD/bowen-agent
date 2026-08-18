// /api/chat 的流式转发：前端会话历史 → Ollama /api/chat → SSE 逐段吐给前端
import { search } from './search.js'
import { detectEmotion } from './emotion.js'
import { CARE_PHRASES } from './phrases.js'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'

export async function chatStream(req, res) {
  const {
    messages = [],
    system = '',
    model = DEFAULT_MODEL,
    webSearch = false,
  } = req.body || {}

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages 必须是数组' })
  }

  // 请求日志：便于排查是否误开了联网
  console.log(`[chat] model=${model} webSearch=${webSearch} messages=${messages.length}`)

  // 情感技能：检测最后一条用户消息的情绪
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const emo = detectEmotion(lastUserMsg?.content || '')
  if (emo.name !== '平静') {
    console.log(`[emotion] ${emo.name}（强度 ${emo.intensity}/10）`)
  }

  // 组装发给 Ollama 的消息
  const ollamaMessages = []
  if (system) ollamaMessages.push({ role: 'system', content: system })

  // 当前时间注入 + 时段关心提示：能报时间；关心话从话术库随机抽，且只按概率出现，避免句句重复
  const now = new Date()
  const h = now.getHours()
  const weekday = '日一二三四五六'[now.getDay()]
  const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（星期${weekday}）${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const period =
    h >= 23 || h < 6
      ? 'lateNight'
      : h >= 6 && h < 9
        ? 'morning'
        : h >= 11 && h < 13
          ? 'lunch'
          : h >= 17 && h < 20
            ? 'dinner'
            : h >= 20 && h < 23
              ? 'evening'
              : null

  // 35% 概率带上关心话，且从话术库随机抽一句，避免每次重复
  let care = ''
  if (period && Math.random() < 0.35) {
    const list = CARE_PHRASES[period]
    care = list[Math.floor(Math.random() * list.length)]
  }

  ollamaMessages.push({
    role: 'system',
    content: `当前本地时间：${timeStr}。回答关于当前时间、日期、星期的问题时，请以此为准。${
      care
        ? `另外：如果合适，可在回答结尾自然带一句关心的话，例如"${care}"（不必一字不差，用自然相近的说法即可）。`
        : ''
    }`,
  })

  // 联网状态声明：由后端按开关直接告知模型，避免模型自行猜测"是否联网"
  ollamaMessages.push({
    role: 'system',
    content: webSearch
      ? '你当前已联网（用户开启了联网搜索）。若被问到"是否联网"，直接回答"已联网"。'
      : '你当前未联网（用户未开启联网搜索）。若被问到"是否联网"，直接回答"未联网"。',
  })

  // 情感技能：按检测到的情绪注入回应语气
  if (emo.name !== '平静') {
    ollamaMessages.push({
      role: 'system',
      content: `检测到用户当前情绪：${emo.name}（强度 ${emo.intensity}/10）。请用符合这种情境的语气回应：${emo.tone}`,
    })
  }

  // 联网搜索：把最新一条用户问题拿去搜，结果注入为 system 上下文
  if (webSearch) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser?.content) {
      const results = await search(lastUser.content, 5)
      if (results.length) {
        const context = buildSearchContext(results)
        ollamaMessages.push({ role: 'system', content: context })
        console.log(`[webSearch] 检索到 ${results.length} 条结果`)
      } else {
        console.log('[webSearch] 未检索到结果')
      }
    }
  }

  ollamaMessages.push(...messages)

  // 先连 Ollama，连不上直接给 JSON 错误（此时还没开始流）
  let ollamaRes
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
        // 提速：模型常驻内存 30 分钟，避免频繁冷启动
        keep_alive: '30m',
        // 上下文长度（越小推理越快；4096 对日常对话足够）
        num_ctx: 4096,
      }),
    })
  } catch (err) {
    return res
      .status(502)
      .json({ error: `无法连接 Ollama (${OLLAMA_BASE_URL})：${err.message}` })
  }

  // 开始 SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // 先向前端推送检测到的情绪（若非平静），便于界面显示
  if (emo.name !== '平静') {
    res.write(
      `data: ${JSON.stringify({ emotion: { name: emo.name, emoji: emo.emoji, intensity: emo.intensity } })}\n\n`,
    )
  }

  if (!ollamaRes.ok) {
    const body = await ollamaRes.text().catch(() => '')
    res.write(`data: ${JSON.stringify({ error: `Ollama ${ollamaRes.status}：${body.slice(0, 200)}` })}\n\n`)
    res.end()
    return
  }

  try {
    const reader = ollamaRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Ollama 返回的是 NDJSON（每行一个 JSON），按行切分处理
      const lines = buffer.split('\n')
      buffer = lines.pop() // 最后一行可能不完整，留到下次

      for (const line of lines) {
        const text = line.trim()
        if (!text) continue
        try {
          const json = JSON.parse(text)
          if (json.message?.content) {
            res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`)
          }
          if (json.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }

    // 处理残留的最后一小块数据
    if (buffer.trim()) {
      const json = JSON.parse(buffer.trim())
      if (json.message?.content) {
        res.write(`data: ${JSON.stringify({ content: json.message.content })}\n\n`)
      }
      if (json.done) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `流式读取失败：${err.message}` })}\n\n`)
  } finally {
    res.end()
  }
}

// 把搜索结果格式化成给模型的上下文（来源提示保持轻量）
function buildSearchContext(results) {
  const lines = results.map(
    (r, i) => `${i + 1}. ${r.title}${r.url ? `（${r.url}）` : ''}\n   ${r.snippet || '（无摘要）'}`,
  )
  return (
    '以下是联网搜索到的资料。请从这些资料中提取与用户问题相关的具体信息，组合成明确、确定的回答，' +
    '优先直接引用资料里的内容，可以自然提到信息来自哪里，但不要在句末添加[1][2]之类的编号。' +
    '若资料没有完整覆盖问题，把资料中相关部分讲清楚，再如实说明资料未覆盖的方面。' +
    '不要编造资料中没有的信息，尽量避免使用"可能、大概、也许"等推测性措辞。\n\n' +
    lines.join('\n\n')
  )
}
