import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'
type Color = 'rose' | 'sand' | 'sage' | 'sky' | 'lavender'
type Reminder = { id: number; text: string; color: Color; deadline?: string; pinned: boolean; done: boolean }

const COLORS: Record<Color, { bg: string; border: string; dot: string }> = {
  rose:     { bg: 'rgba(220,150,140,0.18)', border: 'rgba(220,150,140,0.35)', dot: '#e8a09a' },
  sand:     { bg: 'rgba(210,190,155,0.18)', border: 'rgba(210,190,155,0.35)', dot: '#d4bc8a' },
  sage:     { bg: 'rgba(140,175,155,0.18)', border: 'rgba(140,175,155,0.35)', dot: '#8fb5a0' },
  sky:      { bg: 'rgba(130,165,200,0.18)', border: 'rgba(130,165,200,0.35)', dot: '#88aac8' },
  lavender: { bg: 'rgba(170,155,200,0.18)', border: 'rgba(170,155,200,0.35)', dot: '#b0a0cc' },
}

const STORAGE_KEY = 'summertimes_reminders'
function load(): Reminder[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }

export default function Reminders({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [items, setItems] = useState<Reminder[]>(load)
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [color, setColor] = useState<Color>('sand')
  const [deadline, setDeadline] = useState('')

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }, [items])

  function add() {
    if (!text.trim()) return
    setItems(p => [...p, { id: Date.now(), text: text.trim(), color, deadline, pinned: false, done: false }])
    setText(''); setColor('sand'); setDeadline(''); setShowForm(false)
  }
  function toggle(id: number) { setItems(p => p.map(r => r.id === id ? { ...r, done: !r.done } : r)) }
  function pin(id: number) { setItems(p => p.map(r => r.id === id ? { ...r, pinned: !r.pinned } : r)) }
  function remove(id: number) { setItems(p => p.filter(r => r.id !== id)) }

  const sorted = [...items].sort((a, b) => a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : 0)

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>reminders</span>
          <button onClick={() => setShowForm(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>+</button>
        </div>
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass" style={{ margin: '12px 16px', borderRadius: 16, padding: '16px', overflow: 'hidden' }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="提醒内容…" rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                {(Object.keys(COLORS) as Color[]).map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: COLORS[c].dot, border: color === c ? '2px solid rgba(255,255,255,0.8)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 8px', fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: 'rgba(255,255,255,0.7)', outline: 'none', colorScheme: 'dark' }} />
              </div>
              <button onClick={add} style={{ marginTop: 12, width: '100%', background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(255,255,255,0.88)', cursor: 'pointer', letterSpacing: 2 }}>add</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px', scrollbarWidth: 'none' }}>
          <AnimatePresence>
            {sorted.map(r => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                style={{ background: COLORS[r.color].bg, border: `0.5px solid ${COLORS[r.color].border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 10, opacity: r.done ? 0.45 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[r.color].dot, flexShrink: 0, marginTop: 6 }} />
                  <p style={{ flex: 1, fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.88)', textDecoration: r.done ? 'line-through' : 'none', fontFamily: "'Cormorant Garamond', serif" }}>{r.text}</p>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => pin(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: r.pinned ? 1 : 0.4, color: 'rgba(255,255,255,0.8)' }}>◈</button>
                    <button onClick={() => toggle(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: r.done ? 1 : 0.4, color: 'rgba(255,255,255,0.8)' }}>✓</button>
                    <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.4, color: 'rgba(255,255,255,0.8)' }}>×</button>
                  </div>
                </div>
                {r.deadline && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginLeft: 18, letterSpacing: 1, fontStyle: 'italic' }}>{r.deadline}</p>}
                {r.pinned && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, marginLeft: 18, letterSpacing: 2 }}>pinned</p>}
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: 14, marginTop: 60, letterSpacing: 2 }}>nothing yet</p>}
        </div>
      </div>
      <BottomNav current="reminders" onNavigate={onNavigate} />
    </div>
  )
}
