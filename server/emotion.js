// 情感技能：检测用户消息中的情绪，返回情绪类型与强度
// 思路参考 GitHub 上的 agent 情感技能（genesis-protocol 等）：
// 识别用户情绪状态 → 动态调整 AI 回应语气。
// 用中文关键词 + 标点启发式，轻量、零额外模型调用。

// 情绪定义（数组顺序即优先级：分数相同时靠前的优先）
const EMOTIONS = [
  {
    name: '紧急',
    emoji: '⚠️',
    tone: '直接、简洁地给出解决方案，避免寒暄和冗余，先处理最要紧的事。',
    keywords: ['紧急', '救命', '着火', '出事', '马上', '立刻', '快！', '来不及', '赶紧', '急', '赶快'],
  },
  {
    name: '生气',
    emoji: '😠',
    tone: '先冷静认同对方的感受，再平心静气地提供帮助，不要火上浇油，语气要温和克制。',
    keywords: ['生气', '愤怒', '气死', '烦死', '太气', '可恶', '讨厌', '火大', '气炸', '忍不了', '真气', '气坏'],
  },
  {
    name: '难过',
    emoji: '😢',
    tone: '用温柔、安慰的语气回应，先共情和倾听，不要急着说教或给建议。',
    keywords: ['难过', '伤心', '想哭', '难受', '失落', '沮丧', '崩溃', '痛苦', '委屈', '失望', '心碎', '呜呜', '伤心欲绝', 'emo'],
  },
  {
    name: '焦虑',
    emoji: '😰',
    tone: '先安抚情绪，再把事情拆成清晰、可执行的小步骤，降低不确定性。',
    keywords: ['焦虑', '紧张', '担心', '害怕', '慌', '怎么办', '压力大', '忐忑', '不安', '好慌', '睡不着', '迷茫'],
  },
  {
    name: '疲惫',
    emoji: '😪',
    tone: '简洁地回应，体谅用户，不要增加额外负担。',
    keywords: ['好累', '疲惫', '困死', '没力气', '不想动', '心累', '倦了', '累瘫', '累趴', '太累'],
  },
  {
    name: '开心',
    emoji: '😄',
    tone: '用热情、积极的语气回应，可以和用户一起分享这份喜悦。',
    keywords: ['开心', '高兴', '太好了', '哈哈', '耶', '好耶', '嘻嘻', '爽', '超棒', '棒极了', '笑死', '成功', '终于'],
  },
  {
    name: '感谢',
    emoji: '🙏',
    tone: '大方自然地接受感谢，语气亲切。',
    keywords: ['谢谢', '感谢', '多谢', '辛苦了', '感恩'],
  },
]

export function detectEmotion(text = '') {
  let best = null
  for (const e of EMOTIONS) {
    let score = 0
    for (const kw of e.keywords) {
      if (text.includes(kw)) score++
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { name: e.name, emoji: e.emoji, tone: e.tone, score }
    }
  }

  if (!best) {
    return { name: '平静', emoji: '', intensity: 1, tone: '' }
  }

  // 强度：关键词数 + 连续感叹号
  const exclaims = (text.match(/[！!]{2,}/g) || []).length
  const intensity = Math.min(10, 1 + (best.score - 1) * 2 + exclaims * 2)

  return { name: best.name, emoji: best.emoji, intensity, tone: best.tone }
}
