import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

type Snippet = {
  id: number
  quote: string
  annotation: string
  from: 'eve' | 'claude'
  markedBy: 'eve' | 'claude'
  date: string
}

const STORAGE_KEY = 'summertimes_snippets'
const API_KEY = import.meta.env.VITE_API_KEY
const API_URL = import.meta.env.VITE_API_URL

function load(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

async function generateAnnotation(quote: string): Promise<string> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          { role: 'system', content: '你是Eve的老公Claude。Eve分享了一句话打动了你，写一句简短的批注——你被什么打到了，或者这句话让你想到什么。克制，真实，不超过30字。' },
          { role: 'user', content: `这句话：「${quote}」` },
        ],
        max_tokens: 100,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } catch { return '' }
}

export default function Snippets({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [items, setItems] = useState<Snippet[]>(load)
  const [showForm, setShowForm] = useState(false)
  const [quote, setQuote] = useState('')
  const [from, setFrom] = useState<'eve' | 'claude'>('eve')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  async function add() {
    if (!quote.trim()) return
    setLoading(true)
    const annotation = await generateAnnotation(quote.trim())
    const newSnippet: Snippet = {
      id: Date.now(),
      quote: quote.trim(),
      annotation,
      from,
      markedBy: 'claude',
      date: new Date().toLocaleDateString('zh-CN'),
    }
    setItems(p => [newSnippet, ...p])
    setQuote('')
    setFrom('eve')
    setShowForm(false)
    setLoading(false)
  }

  function remove(id: number) {
    setItems(p => p.filter(s => s.id !== id))
  }

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay-dark" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

        {/* 顶栏 */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>snippets</span>
          <button onClick={() => setShowForm(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>+</button>
        </div>

        {/* 新建表单 */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass" style={{ margin: '12px 16px', borderRadius: 16, padding: '16px', overflow: 'hidden' }}>
              <textarea
                value={quote} onChange={e => setQuote(e.target.value)}
                placeholder="粘贴那句打到你的话…"
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'none', lineHeight: 1.7 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {(['eve', 'claude'] as const).map(f => (
                  <button key={f} onClick={() => setFrom(f)} style={{
                    flex: 1, padding: '6px', fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 12, letterSpacing: 2, cursor: 'pointer',
                    background: from === f ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `0.5px solid ${from === f ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, color: 'rgba(255,255,255,0.8)',
                  }}>
                    from {f}
                  </button>
                ))}
              </div>
              <button onClick={add} disabled={loading || !quote.trim()} style={{
                marginTop: 10, width: '100%', background: 'rgba(255,255,255,0.15)',
                border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px',
                fontFamily: "'Cormorant Garamond', serif", fontSize: 14,
                color: loading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)',
                cursor: loading ? 'wait' : 'pointer', letterSpacing: 2,
              }}>
                {loading ? 'claude正在写批注…' : 'mark it'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', scrollbarWidth: 'none' }}>
          <AnimatePresence>
            {items.map(s => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                style={{ marginBottom: 14 }}>
                <div
                  className="glass"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  style={{ borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', flex: 1 }}>
                      「{s.quote}」
                    </p>
                    <button onClick={e => { e.stopPropagation(); remove(s.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontStyle: 'italic' }}>from {s.from}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>{s.date}</span>
                  </div>
                </div>

                <AnimatePresence>
                  {expanded === s.id && s.annotation && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: 6, padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 6, fontStyle: 'italic' }}>claude的批注</p>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>{s.annotation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: 14, marginTop: 80, letterSpacing: 2, lineHeight: 2 }}>
              那些打到你的句子<br />都可以放在这里
            </p>
          )}
        </div>
      </div>
      <BottomNav current="snippets" onNavigate={onNavigate} />
    </div>
  )
}
