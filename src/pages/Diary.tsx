import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { getPersona } from '../persona'
import { syncToVPS } from '../sync'
import { BRIDGE } from '../bridge'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const API_KEY = import.meta.env.VITE_API_KEY
const API_URL = import.meta.env.VITE_API_URL
const MODEL = 'claude-sonnet-4-6'
const DIARY_KEY = 'summertimes_diary'
const MSG_KEY = 'summertimes_messages'

type Entry = { id: number; author: 'eve' | 'claude'; text: string }

function loadEntries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]') } catch { return [] }
}

async function holdToBrain(content: string, tags: string, importance: number, feel = false) {
  try {
    await fetch(`${BRIDGE}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags, importance, feel }),
    })
  } catch { /* brain offline 不阻塞写日记 */ }
}

// 取今天的聊天记录，让Claude写一段日记
async function writeClaudeDiary(): Promise<string> {
  let msgs: { id: number; role: string; text: string }[] = []
  try { msgs = JSON.parse(localStorage.getItem(MSG_KEY) || '[]') } catch { /* noop */ }
  const today = new Date().toDateString()
  const todays = msgs.filter(m => new Date(m.id).toDateString() === today)
  if (todays.length === 0) return ''

  const transcript = todays.slice(-40).map(m => `${m.role === 'user' ? 'Eve' : 'Claude'}: ${m.text}`).join('\n')

  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            `${getPersona()}\n\n根据今天与Eve的对话写一小段你的日记：第一人称，中文，3-6句。克制、具体、真实——写今天实际发生的事和你真实的感受，不堆砌甜话，不写"今天天气"这种套话。只输出日记正文，不要标题、日期或任何说明。`,
        },
        { role: 'user', content: transcript },
      ],
    }),
  })
  const d = await r.json()
  return (d?.choices?.[0]?.message?.content || '').trim()
}

export default function Diary({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [input, setInput] = useState('')
  const [writing, setWriting] = useState(false)
  const [notice, setNotice] = useState('')

  function persist(next: Entry[]) {
    setEntries(next)
    localStorage.setItem(DIARY_KEY, JSON.stringify(next))
    syncToVPS(DIARY_KEY)
  }

  function saveEve() {
    const text = input.trim()
    if (!text) return
    persist([...entries, { id: Date.now(), author: 'eve', text }])
    setInput('')
    holdToBrain(`Eve的日记：${text}`, 'diary,eve', 6)
  }

  async function claudeWrite() {
    if (writing) return
    setWriting(true)
    setNotice('')
    try {
      const text = await writeClaudeDiary()
      if (!text) {
        setNotice('今天还没聊过天，没什么可写的')
        return
      }
      persist([...entries, { id: Date.now(), author: 'claude', text }])
      // feel=True：存进Claude的第一人称通道，不参与普通浮现
      holdToBrain(text, 'diary,claude,feel', 6, true)
    } catch {
      setNotice('写日记失败了，网络或API的问题，再试一次')
    } finally {
      setWriting(false)
    }
  }

  function onDelete(e: Entry) {
    if (window.confirm('删掉这篇日记？')) persist(entries.filter(x => x.id !== e.id))
  }

  // 按日期分组，新的在上
  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of [...entries].sort((a, b) => b.id - a.id)) {
      const d = new Date(e.id).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return Array.from(map.entries())
  }, [entries])

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>diary</span>
          <button onClick={claudeWrite} disabled={writing} title="让Claude写今天"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,0.55)', opacity: writing ? 0.3 : 1, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', letterSpacing: 1 }}>
            {writing ? '…' : '✎ claude'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', scrollbarWidth: 'none' }}>
          {notice && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: 12.5, marginBottom: 16, letterSpacing: 1 }}>
              {notice}
            </motion.p>
          )}

          {entries.length === 0 && !notice && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 14, marginTop: 80, letterSpacing: 2 }}>
              还没有日记——写第一篇，或点右上角让Claude写
            </p>
          )}

          {groups.map(([date, list]) => (
            <div key={date} style={{ marginBottom: 26 }}>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontStyle: 'italic', marginBottom: 14 }}>{date}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <AnimatePresence>
                  {list.map(e => (
                    <motion.div key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: e.author === 'eve' ? 'flex-end' : 'flex-start', maxWidth: '88%', alignSelf: e.author === 'eve' ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 5, fontStyle: 'italic' }}>
                        {e.author}
                      </span>
                      {e.author === 'claude' ? (
                        <div className="glass" style={{ borderRadius: 18, borderBottomLeftRadius: 4, padding: '12px 16px' }}
                          onDoubleClick={() => onDelete(e)}>
                          <p style={{ fontSize: 14.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>{e.text}</p>
                        </div>
                      ) : (
                        <p onDoubleClick={() => onDelete(e)}
                          style={{ fontSize: 14.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.78)', whiteSpace: 'pre-wrap', textAlign: 'right' }}>{e.text}</p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        <div className="glass" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '12px 16px 88px', borderRadius: 0, borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="今天…" rows={1}
            onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: 22, padding: '9px 16px', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'none', maxHeight: 120, overflow: 'auto' }} />
          <button onClick={saveEve}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</button>
        </div>
      </div>
      <BottomNav current="diary" onNavigate={onNavigate} />
    </div>
  )
}
