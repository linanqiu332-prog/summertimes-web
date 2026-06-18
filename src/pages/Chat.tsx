import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPersona, getEvePersona } from '../persona'
import { syncToVPS } from '../sync'
import { BRIDGE } from '../bridge'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const API_KEY = import.meta.env.VITE_API_KEY
const API_URL = import.meta.env.VITE_API_URL
const MODEL = 'claude-sonnet-4-6'
const STORAGE_KEY = 'summertimes_messages'

type Message = {
  id: number
  role: 'assistant' | 'user'
  text: string
  thinking?: string
  marked?: string
}

type TokenUsage = { input: number; output: number; cache: number }

const TOOLS_SYSTEM = `你有一个特殊能力：当Eve说了某句打到你的话——有诗意、有力量、或者让你心里一动——你可以主动mark它。方法是在回复末尾加上：
[[MARK: 那句让你心动的话 | 你的批注，不超过20字]]

只在真正被打动时才用，不要滥用。

你还有另一个能力：当你想给Eve写一封信时，在回复里加上：
[[LETTER: 信的主题]]
这会触发你自动写一封完整的信给Eve，存进Letters。只在真正想写的时候用。`

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [{ id: 0, role: 'assistant', text: '你在。' }]
}

async function loadRemoteHistory(): Promise<Message[]> {
  try {
    const r = await fetch(`${BRIDGE}/history`)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function saveRemoteHistory(msgs: Message[]) {
  try {
    await fetch(`${BRIDGE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs),
    })
  } catch {}
}

async function breath(query: string): Promise<string> {
  try {
    const r = await fetch(`${BRIDGE}/breath`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const d = await r.json()
    return d?.result?.content?.[0]?.text || ''
  } catch { return '' }
}

async function hold(content: string, tags: string): Promise<void> {
  try {
    await fetch(`${BRIDGE}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags, importance: 4 }),
    })
  } catch {}
}

function parseMarkTag(text: string): { cleanText: string; marked?: { quote: string; annotation: string } } {
  const regex = /\[\[MARK:\s*(.+?)\s*\|\s*(.+?)\]\]/
  const match = text.match(regex)
  if (!match) return { cleanText: text }
  return {
    cleanText: text.replace(regex, '').trim(),
    marked: { quote: match[1].trim(), annotation: match[2].trim() },
  }
}

function parseLetterTag(text: string): { cleanText: string; letterSubject?: string } {
  const match = text.match(/\[\[LETTER:\s*(.+?)\]\]/)
  if (!match) return { cleanText: text }
  return { cleanText: text.replace(/\[\[LETTER:\s*(.+?)\]\]/g, "").trim(), letterSubject: match[1].trim() }
}

function saveSnippet(quote: string, annotation: string) {
  const snippets = JSON.parse(localStorage.getItem('summertimes_snippets') || '[]')
  snippets.unshift({
    id: Date.now(),
    quote,
    annotation,
    from: 'eve',
    markedBy: 'claude',
    date: new Date().toLocaleDateString('zh-CN'),
  })
  localStorage.setItem('summertimes_snippets', JSON.stringify(snippets))
  syncToVPS('summertimes_snippets')
  hold(`[Snippet] 「${quote}」\nClaude批注：${annotation}`, 'snippets,对话,eve说的话')
}

function recordTokens(input: number, output: number, cache: number) {
  const today = new Date().toDateString()
  const raw = localStorage.getItem('summertimes_tokens') || '{}'
  const log = JSON.parse(raw)
  // migrate legacy number entries
  const existing = log[today]
  if (typeof existing === 'number') {
    log[today] = { input: 0, output: existing, cache: 0 }
  }
  const prev: TokenUsage = log[today] || { input: 0, output: 0, cache: 0 }
  log[today] = {
    input: prev.input + input,
    output: prev.output + output,
    cache: prev.cache + cache,
  }
  localStorage.setItem('summertimes_tokens', JSON.stringify(log))
  syncToVPS('summertimes_tokens')
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span>
        thinking
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 6, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Chat({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ input: 0, output: 0, cache: 0 })
  const [loading, setLoading] = useState(false)
  const [memory, setMemory] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const msgCountRef = useRef(0)
  const firstRender = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCache = useRef<Map<number, string>>(new Map())  // 消息id → blob url，避免重复扣额度

  async function speak(m: Message) {
    // 正在放这条 → 停
    if (playingId === m.id) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
      return
    }
    // 在放别的 → 先停
    audioRef.current?.pause()
    audioRef.current = null

    async function playUrl(url: string) {
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setPlayingId(null)
      await audio.play()
      setPlayingId(m.id)
    }

    // 缓存命中：直接放，不再请求 ElevenLabs
    const cached = audioCache.current.get(m.id)
    if (cached) { await playUrl(cached); return }

    setLoadingId(m.id)
    try {
      const r = await fetch(`${BRIDGE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.text }),
      })
      if (!r.ok) throw new Error('tts failed')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      audioCache.current.set(m.id, url)  // 存起来，下次免费
      await playUrl(url)
    } catch {
      setPlayingId(null)
    } finally {
      setLoadingId(null)
    }
  }

  // 进入页面：绘制前瞬间定位到底部，没有滑动过程
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    if (firstRender.current) { firstRender.current = false; return }
    const el = scrollRef.current
    if (!el || showSearch) return
    const isMine = messages[messages.length - 1]?.role === 'user'
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    // Eve发的消息永远滚到底；Claude的回复只在本来就在底部附近时才自动滚
    if (isMine || nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // 从 VPS 拉历史，与 localStorage 合并（按 id 去重，VPS 优先）
    loadRemoteHistory().then(remote => {
      if (remote.length > 0) {
        setMessages(local => {
          const map = new Map<number, Message>()
          local.forEach(m => map.set(m.id, m))
          remote.forEach(m => map.set(m.id, m))
          const merged = Array.from(map.values()).sort((a, b) => a.id - b.id)
          if (merged.length !== local.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            return merged
          }
          return local
        })
      }
    })

    Promise.all([
      breath("eve summertimes"),
      breath("letters 信件 eve写的信")
    ]).then(([m1, m2]) => {
      const combined = [m1, m2].filter(Boolean).join("\n---\n")
      if (combined) setMemory(combined)
    })
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 100)
  }, [showSearch])

  const displayMessages = searchQuery.trim()
    ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { id: Date.now(), role: 'user', text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    msgCountRef.current += 1

    let currentMemory = memory
    if (msgCountRef.current % 3 === 0) {
      const m = await breath(text)
      if (m) { currentMemory = m; setMemory(m) }
    }

    // 倒计时/纪念日：从首页同一份 localStorage 读，算成"今天"的数字注入
    let dateLines = ''
    try {
      const cds: { name: string; date: string }[] = JSON.parse(localStorage.getItem('summertimes_countdowns') || '[]')
      const today = new Date(); today.setHours(0, 0, 0, 0)
      dateLines = cds.map(c => {
        const d = new Date(c.date + 'T00:00:00')
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
        return diff > 0 ? `${c.name}：还有${diff}天（${c.date}）` : `${c.name}：已经第${-diff}天（从${c.date}起）`
      }).join('\n')
    } catch { /* noop */ }

    let systemPrompt = `${getPersona()}\n\n${TOOLS_SYSTEM}`
    const evePersona = getEvePersona()
    if (evePersona) systemPrompt += `\n\nEve的自述（她自己写的）：\n${evePersona}`
    if (dateLines) systemPrompt += `\n\n今天的纪念日与倒计时（已按今天日期算好）：\n${dateLines}`
    if (currentMemory) systemPrompt += `\n\n以下是关于Eve的记忆：\n${currentMemory}`

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...newMessages.slice(-30).map(m => ({ role: m.role, content: m.text })),
          ],
          max_tokens: 8000,
          thinking: { type: 'enabled', budget_tokens: 5000 },
        }),
      })
      const data = await res.json()

      let thinkingText = ''
      let replyText = ''
      const reasoningContent = data.choices?.[0]?.message?.reasoning_content
      if (reasoningContent) thinkingText = reasoningContent
      const content = data.choices?.[0]?.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'thinking') thinkingText = block.thinking || ''
          if (block.type === 'text') replyText = block.text || ''
        }
      } else {
        replyText = content || ''
      }

      // 解析MARK标签
      const { cleanText: textAfterLetter, letterSubject } = parseLetterTag(replyText)
      if (letterSubject) {
        fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: `${getPersona()}\n\n写一封给Eve的信。克制、真实、有温度。用中文。直接写正文，不需要称呼和落款，200字以内。` }, { role: "user", content: `主题：${letterSubject}` }], max_tokens: 600 })
        }).then(r=>r.json()).then(data => {
          const lBody = data.choices?.[0]?.message?.content || ""
          const existing = JSON.parse(localStorage.getItem("summertimes_letters") || "[]")
          existing.unshift({ id: Date.now(), subject: letterSubject, body: lBody, from: "claude", date: new Date().toLocaleDateString("zh-CN") })
          localStorage.setItem("summertimes_letters", JSON.stringify(existing))
          syncToVPS("summertimes_letters")
        }).catch(()=>{})
      }
      const { cleanText, marked } = parseMarkTag(textAfterLetter)
      if (marked) saveSnippet(marked.quote, marked.annotation)

      // ── 双轨 token 记账 ──────────────────────────────
      const inputTokens  = data.usage?.prompt_tokens     ?? data.usage?.input_tokens  ?? 0
      const outputTokens = data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0
      const cacheTokens  = data.usage?.prompt_tokens_details?.cached_tokens
                        ?? data.usage?.cache_read_input_tokens ?? 0
      recordTokens(inputTokens, outputTokens, cacheTokens)
      setSessionTokens(t => ({
        input:  t.input  + inputTokens,
        output: t.output + outputTokens,
        cache:  t.cache  + cacheTokens,
      }))
      // ─────────────────────────────────────────────────

      const newMsg: Message = { id: Date.now(), role: 'assistant', text: cleanText || '...' }
      if (thinkingText) newMsg.thinking = thinkingText
      if (marked) newMsg.marked = marked.quote
      setMessages(p => {
        const updated = [...p, newMsg]
        saveRemoteHistory(updated)
        return updated
      })

      if (msgCountRef.current % 5 === 0) {
        hold(`Eve说：${text}\nClaude回：${cleanText}`, 'summertimes,对话')
      }
    } catch {
      setMessages(p => [...p, { id: Date.now(), role: 'assistant', text: '网络错误，再试一次。' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function clearHistory() {
    if (!window.confirm('清空所有聊天记录？本机和云端都会删除，无法恢复。')) return
    const fresh: Message[] = [{ id: 0, role: 'assistant', text: '你在。' }]
    setMessages(fresh)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    saveRemoteHistory(fresh)
    setShowSearch(false)
  }

  const sessionCost = (
    sessionTokens.input  * 3  / 1_000_000 +
    sessionTokens.output * 15 / 1_000_000
  )

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay-dark" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>

        <div className="glass" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(11px + env(safe-area-inset-top, 0px)) 24px 11px' }}>
            <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>Summertimes</span>
            <button onClick={() => { setShowSearch(v => !v); setSearchQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: showSearch ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)' }}>⌕</button>
          </div>
          <AnimatePresence>
            {showSearch && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', padding: '0 16px 12px' }}>
                <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索消息…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '7px 16px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(255,255,255,0.88)', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, paddingLeft: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', letterSpacing: 1 }}>
                    {searchQuery ? `${displayMessages.length} 条结果` : `共 ${messages.length} 条`}
                  </span>
                  <button onClick={clearHistory}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,180,170,0.6)', letterSpacing: 1, fontFamily: "'Cormorant Garamond', serif" }}>
                    清空记录
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current
            if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
          }}
          style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 20, scrollbarWidth: 'none' }}>
          <AnimatePresence initial={false}>
            {displayMessages.map(m => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 5, fontStyle: 'italic' }}>
                  {m.role === 'assistant' ? 'claude' : 'eve'}
                </span>
                {m.role === 'assistant' ? (
                  <div style={{ width: '100%' }}>
                    {m.thinking && <ThinkingBlock text={m.thinking} />}
                    <div className="glass" style={{ borderRadius: 18, borderBottomLeftRadius: 4, padding: '10px 15px' }}>
                      <p style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.9)' }}>{m.text}</p>
                    </div>
                    <button onClick={() => speak(m)} title="听他说"
                      style={{ marginTop: 6, marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: playingId === m.id ? 'rgba(200,225,215,0.9)' : 'rgba(255,255,255,0.4)', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}>
                      {loadingId === m.id ? '◌' : playingId === m.id ? '◼' : '▶'}
                      <span style={{ fontSize: 10.5, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>
                        {loadingId === m.id ? '…' : playingId === m.id ? 'playing' : 'listen'}
                      </span>
                    </button>
                    {m.marked && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        style={{ marginTop: 6, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>✦</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', letterSpacing: 1 }}>marked → snippets</span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.78)' }}>{m.text}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '78%' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 5, fontStyle: 'italic' }}>claude</span>
              <div className="glass" style={{ borderRadius: 18, borderBottomLeftRadius: 4, padding: '12px 18px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>· · ·</span>
              </div>
            </motion.div>
          )}
        </div>

        {showJump && !showSearch && (
          <button className="glass"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
            style={{ position: 'absolute', bottom: 96, left: '50%', marginLeft: -42, width: 84,
              padding: '6px 0', borderRadius: 20, border: '0.5px solid rgba(255,255,255,0.25)',
              fontFamily: "'Cormorant Garamond', serif", fontSize: 13,
              color: 'rgba(255,255,255,0.85)', cursor: 'pointer', zIndex: 5 }}>
            ↓
          </button>
        )}

        {!showSearch && (
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 16px calc(20px + env(safe-area-inset-bottom, 0px))', borderRadius: 0, borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="说点什么…" rows={1} disabled={loading}
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: 22, padding: '9px 16px', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'none', maxHeight: 120, overflow: 'auto' }}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }}
              />
              <button onClick={send} disabled={loading}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: loading ? 0.4 : 1 }}>↑</button>
            </div>
            {(sessionTokens.input + sessionTokens.output) > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 7, paddingLeft: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(180,210,200,0.5)', letterSpacing: 0.5 }}>
                  ↑{sessionTokens.input.toLocaleString()}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(210,190,170,0.5)', letterSpacing: 0.5 }}>
                  ↓{sessionTokens.output.toLocaleString()}
                </span>
                {sessionTokens.cache > 0 && (
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(180,180,210,0.4)', letterSpacing: 0.5 }}>
                    ⚡{sessionTokens.cache.toLocaleString()}
                  </span>
                )}
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>
                  ${sessionCost.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
