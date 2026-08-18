// 与后端 /api/chat 的 SSE 流式通信客户端
// 用法：
//   streamChat({
//     messages: [{ role: 'user', content: '...' }],
//     system: '可选系统提示词',
//     model: '可选模型',
//     webSearch: false,        // 是否联网搜索
//     onContent: (chunk) => {},   // 每收到一段内容
//     onEmotion: (emo) => {},     // 收到情绪检测结果 { name, emoji, intensity }
//     onError: (msg) => {},       // 出错
//     onDone: () => {},           // 流结束
//   })
export async function streamChat({ messages, system, model, webSearch, onContent, onEmotion, onDone, onError }) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system, model, webSearch }),
    })
  } catch (err) {
    onError?.(`网络错误：${err.message}`)
    return
  }

  if (!res.ok) {
    let msg = `请求失败（HTTP ${res.status}）`
    try {
      const j = await res.json()
      if (j.error) msg = j.error
    } catch {
      // 响应不是 JSON，保留默认提示
    }
    onError?.(msg)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // 解析一行 data: payload，返回 {content|done|error} 或 null
  function handleData(payload) {
    if (!payload) return
    if (payload === '[DONE]') {
      onDone?.()
      return
    }
    let json
    try {
      json = JSON.parse(payload)
    } catch {
      return
    }
    if (json.emotion) onEmotion?.(json.emotion)
    if (json.content) onContent?.(json.content)
    if (json.done) onDone?.()
    if (json.error) onError?.(json.error)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 事件以空行分隔
      const events = buffer.split('\n\n')
      buffer = events.pop() // 最后一段可能不完整，留到下次

      for (const ev of events) {
        for (const line of ev.split('\n')) {
          if (line.startsWith('data: ')) handleData(line.slice(6))
        }
      }
    }
    // 处理残留的最后一段
    if (buffer.trim().startsWith('data: ')) {
      handleData(buffer.trim().slice(6))
    }
  } catch (err) {
    onError?.(`读取流失败：${err.message}`)
  } finally {
    onDone?.()
  }
}
