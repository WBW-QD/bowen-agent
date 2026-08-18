// 联网搜索：多引擎免 Key 抓取 + 可选 Bing 官方 API
// 默认引擎链：百度 → 搜狗 → 必应cn（国内均可访问），全部失败回退 DuckDuckGo / Wikipedia
// 配置：SEARCH_PROVIDER=baidu|sogou|bing 指定主引擎；SEARCH_API_KEY+SEARCH_PROVIDER=bing 走官方 API

const BING_API_KEY = process.env.SEARCH_API_KEY || ''
const SEARCH_PROVIDER = process.env.SEARCH_PROVIDER || 'baidu'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const ZH_HEADERS = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }

export async function search(query, limit = 5) {
  const attempts = []

  if (SEARCH_PROVIDER === 'bing' && BING_API_KEY) {
    attempts.push(searchBingApi)
  } else {
    const chain =
      {
        baidu: [searchBaidu, searchSogou, searchBingHtml],
        sogou: [searchSogou, searchBaidu, searchBingHtml],
        bing: [searchBingHtml, searchBaidu, searchSogou],
      }[SEARCH_PROVIDER] || [searchBaidu, searchSogou, searchBingHtml]
    attempts.push(...chain, searchDuckDuckGo, searchWikipedia)
  }

  for (const fn of attempts) {
    try {
      const results = await fn(query, limit)
      if (results.length) return results.slice(0, limit)
    } catch {
      // 尝试下一个引擎
    }
  }
  return []
}

// ---------- 百度 ----------
async function searchBaidu(query, limit) {
  const res = await fetch(
    `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8`,
    { headers: ZH_HEADERS },
  )
  if (!res.ok) throw new Error(`Baidu ${res.status}`)
  const html = await res.text()

  const results = []
  const h3Re = /<h3 class="t"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs
  let m
  while ((m = h3Re.exec(html)) !== null && results.length < limit) {
    const url = m[1]
    // 清洗标题：去标签、实体、内嵌链接、面包屑
    const title = clean(m[2])
    if (!title || url.startsWith('javascript')) continue
    // 摘要：从标题后截取一段，优先取内容摘要容器
    const after = html.slice(h3Re.lastIndex, h3Re.lastIndex + 2500)
    const abs =
      /<span class="content-right[^"]*"[^>]*>(.*?)<\/span>/s.exec(after) ||
      /<div class="c-abstract[^"]*"[^>]*>(.*?)<\/div>/s.exec(after)
    const snippet = abs ? clean(abs[1]) : ''
    results.push({ title, snippet: snippet.slice(0, 200), url })
  }
  return results
}

// ---------- 搜狗 ----------
async function searchSogou(query, limit) {
  const res = await fetch(
    `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
    { headers: ZH_HEADERS },
  )
  if (!res.ok) throw new Error(`Sogou ${res.status}`)
  const html = await res.text()

  const results = []
  const h3Re = /<h3 class="vr-title"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs
  let m
  while ((m = h3Re.exec(html)) !== null && results.length < limit) {
    const url = m[1]
    const title = clean(m[2])
    if (!title) continue
    const after = html.slice(h3Re.lastIndex, h3Re.lastIndex + 1800)
    const abs = /<div class="text-layout[^"]*"[^>]*>(.*?)<\/div>/s.exec(after)
    const snippet = abs ? clean(abs[1]) : ''
    results.push({ title, snippet: snippet.slice(0, 200), url })
  }
  return results
}

// ---------- 必应网页搜索（cn.bing.com）----------
async function searchBingHtml(query, limit) {
  const res = await fetch(
    `https://cn.bing.com/search?q=${encodeURIComponent(query)}`,
    { headers: ZH_HEADERS },
  )
  if (!res.ok) throw new Error(`Bing ${res.status}`)
  const html = await res.text()

  const results = []
  const blockRe = /<li class="b_algo".*?<\/li>/gs
  let m
  while ((m = blockRe.exec(html)) !== null && results.length < limit) {
    const block = m[0]
    const link =
      /<h2><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>/s.exec(block) ||
      /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s.exec(block)
    if (!link) continue
    let url = link[1]
    if (url.startsWith('/')) url = `https://cn.bing.com${url}`
    if (url.includes('bing.com') && !url.includes('cn.bing.com/search')) continue
    const title = link[2].replace(/<[^>]+>/g, '').trim()
    const snip = /<p[^>]*>(.*?)<\/p>/s.exec(block)
    results.push({
      title,
      snippet: snip ? snip[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '',
      url,
    })
  }
  return results
}

// ---------- Bing 官方 API（需要 SEARCH_API_KEY）----------
// 清洗抓取文本：去 HTML 标签、HTML 实体、内嵌链接文字与面包屑
function clean(raw) {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/https?:\/\/\S+\s*/g, '') // 去掉内嵌的链接文字
    .replace(/\s*›.*$/g, '') // 去掉面包屑尾巴
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchBingApi(query, limit) {
  const res = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${limit}`,
    { headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY } },
  )
  if (!res.ok) throw new Error(`Bing ${res.status}`)
  const json = await res.json()
  return (json.webPages?.value || []).map((p) => ({
    title: p.name,
    snippet: p.snippet,
    url: p.url,
  }))
}

// ---------- 兜底：DuckDuckGo / Wikipedia ----------
async function searchDuckDuckGo(query, limit) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: ZH_HEADERS,
  })
  if (!res.ok) throw new Error(`DDG ${res.status}`)
  const html = await res.text()
  const results = []
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs
  const snippetRe = /class="result__snippet"[^>]*>(.*?)<\/a>/gs
  let m
  let i = 0
  while ((m = linkRe.exec(html)) !== null && i < limit) {
    let url = m[1]
    const uddg = /uddg=([^&]+)/.exec(url)
    if (uddg) url = decodeURIComponent(uddg[1])
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (!title) continue
    results.push({ title, snippet: '', url })
    i++
  }
  let j = 0
  while ((m = snippetRe.exec(html)) !== null) {
    if (results[j]) {
      results[j].snippet = m[1].replace(/<[^>]+>/g, '').trim().slice(0, 200)
      j++
    }
  }
  return results
}

async function searchWikipedia(query, limit) {
  const res = await fetch(
    `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&format=json&srlimit=${limit}&utf8=1`,
    { headers: { 'User-Agent': 'BowenAgent/1.0' } },
  )
  if (!res.ok) throw new Error(`Wiki ${res.status}`)
  const json = await res.json()
  return (json.query?.search || []).map((s) => ({
    title: s.title,
    snippet: s.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').slice(0, 200),
    url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
  }))
}
