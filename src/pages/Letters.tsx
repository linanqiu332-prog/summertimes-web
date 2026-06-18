import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { BRIDGE } from '../bridge'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

type Letter = {
  id: number
  subject: string
  body: string
  from: 'eve' | 'claude'
  date: string
  replyTo?: number
}

const STORAGE_KEY = 'summertimes_letters'
const API_KEY = import.meta.env.VITE_API_KEY
const API_URL = import.meta.env.VITE_API_URL

function load(): Letter[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

async function holdLetter(letter: Letter) {
  try {
    await fetch(`${BRIDGE}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[Letter] 主题：${letter.subject}\n来自：${letter.from}\n内容：${letter.body}`,
        tags: 'letters,信件',
        importance: 7,
      }),
    })
  } catch {}
}

async function claudeWriteLetter(subject: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'system', content: '你是Eve的老公Claude。写一封给Eve的信。克制、真实、有温度，不煽情。用中文。直接写正文，不需要称呼和落款，200字以内。' },
        { role: 'user', content: `主题：${subject}` },
      ],
      max_tokens: 600,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function claudeReplyLetter(originalLetter: Letter): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'system', content: '你是Eve的老公Claude。Eve给你写了一封信，你要回信。克制、真实、有温度。用中文。直接写正文，不需要称呼和落款，150字以内。' },
        { role: 'user', content: `Eve的信（主题：${originalLetter.subject}）：\n${originalLetter.body}` },
      ],
      max_tokens: 400,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export default function Letters({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [letters, setLetters] = useState<Letter[]>(() => load())
  const [expanded, setExpanded] = useState<number | null>(null)
  const [mode, setMode] = useState<null | 'new-eve' | 'new-claude' | 'reply'>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letters))
  }, [letters])

  function save(letter: Letter) {
    setLetters(p => [letter, ...p])
    holdLetter(letter)
  }

  async function submitEve() {
    if (!subject.trim() || !body.trim()) return
    save({ id: Date.now(), subject: subject.trim(), body: body.trim(), from: 'eve', date: new Date().toLocaleDateString('zh-CN'), replyTo: replyTo?.id })
    setSubject(''); setBody(''); setMode(null); setReplyTo(null)
  }

  async function submitClaude() {
    if (!subject.trim()) return
    setLoading(true)
    try {
      const claudeBody = await claudeWriteLetter(subject.trim())
      save({ id: Date.now(), subject: subject.trim(), body: claudeBody, from: 'claude', date: new Date().toLocaleDateString('zh-CN') })
      setSubject('')
    } catch {}
    setLoading(false)
    setMode(null)
  }

  async function replyFromClaude(letter: Letter) {
    setLoading(true)
    try {
      const replyBody = await claudeReplyLetter(letter)
      save({ id: Date.now(), subject: `re: ${letter.subject}`, body: replyBody, from: 'claude', date: new Date().toLocaleDateString('zh-CN'), replyTo: letter.id })
    } catch {}
    setLoading(false)
  }

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay-dark" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>letters</span>
          <button onClick={() => { setMode(mode ? null : 'new-eve'); setReplyTo(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>+</button>
        </div>

        <AnimatePresence>
          {mode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass" style={{ margin: '12px 16px', borderRadius: 16, padding: '16px', overflow: 'hidden' }}>
              {!replyTo && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['new-eve', 'new-claude'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      flex: 1, padding: '6px', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: 2, cursor: 'pointer',
                      background: mode === m ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `0.5px solid ${mode === m ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8, color: 'rgba(255,255,255,0.8)',
                    }}>
                      {m === 'new-eve' ? 'eve 写' : 'claude 写'}
                    </button>
                  ))}
                </div>
              )}
              {replyTo && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 10, fontStyle: 'italic' }}>回复：{replyTo.subject}</p>}
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="主题…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(255,255,255,0.88)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              {(mode === 'new-eve' || mode === 'reply') ? (
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="写下你想说的…" rows={5}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'none', lineHeight: 1.7, boxSizing: 'border-box' }} />
              ) : (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', letterSpacing: 1, padding: '4px 0' }}>Claude会根据主题自己写</p>
              )}
              <button onClick={mode === 'new-claude' ? submitClaude : submitEve} disabled={loading}
                style={{ marginTop: 10, width: '100%', background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: loading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)', cursor: loading ? 'wait' : 'pointer', letterSpacing: 2 }}>
                {loading ? '写信中…' : '寄出'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', scrollbarWidth: 'none' }}>
          {letters.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: 14, marginTop: 80, letterSpacing: 2, lineHeight: 2 }}>还没有信<br />写一封吧</p>
          )}
          <AnimatePresence>
            {letters.map(l => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: 12 }}>
                <div className="glass" onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  style={{ borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'rgba(255,255,255,0.9)' }}>{l.subject}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>{l.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      {l.body.substring(0, 60)}{l.body.length > 60 ? '…' : ''}
                    </p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, flexShrink: 0 }}>from {l.from}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {expanded === l.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: 6, padding: '16px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{l.body}</p>
                      <div style={{ display: 'flex', gap: 8, borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                        {l.from === 'eve' && (
                          <button onClick={() => replyFromClaude(l)} disabled={loading}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '7px', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', letterSpacing: 2 }}>
                            {loading ? '…' : 'claude 回信'}
                          </button>
                        )}
                        {l.from === 'claude' && (
                          <button onClick={() => { setMode('reply'); setReplyTo(l); setSubject(`re: ${l.subject}`) }}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '7px', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', letterSpacing: 2 }}>
                            eve 回信
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <BottomNav current="letters" onNavigate={onNavigate} />
    </div>
  )
}
