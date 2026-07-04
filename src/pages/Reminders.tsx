import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { syncToVPS } from '../sync'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'
type Color = 'rose' | 'sand' | 'sage' | 'sky' | 'lavender'
// date：待办的时间（默认创建当天，可改）；列表按它排序、按月折叠
type Reminder = { id: number; text: string; color: Color; date: string; done: boolean }

// 侘寂色系标签
const COLORS: Record<Color, { bg: string; border: string; dot: string }> = {
  rose:     { bg: 'rgba(220,150,140,0.18)', border: 'rgba(220,150,140,0.35)', dot: '#e8a09a' },
  sand:     { bg: 'rgba(210,190,155,0.18)', border: 'rgba(210,190,155,0.35)', dot: '#d4bc8a' },
  sage:     { bg: 'rgba(140,175,155,0.18)', border: 'rgba(140,175,155,0.35)', dot: '#8fb5a0' },
  sky:      { bg: 'rgba(130,165,200,0.18)', border: 'rgba(130,165,200,0.35)', dot: '#88aac8' },
  lavender: { bg: 'rgba(170,155,200,0.18)', border: 'rgba(170,155,200,0.35)', dot: '#b0a0cc' },
}

const STORAGE_KEY = 'summertimes_reminders'
const today = () => new Date().toISOString().slice(0, 10)

// 兼容旧数据：老字段 deadline → date，缺 date 的用 id（创建时间戳）推
function load(): Reminder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map((r: Reminder & { deadline?: string }) => ({
      id: r.id, text: r.text, color: r.color || 'sand', done: !!r.done,
      date: r.date || r.deadline || new Date(r.id).toISOString().slice(0, 10),
    }))
  } catch { return [] }
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export default function Reminders({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [items, setItems] = useState<Reminder[]>(load)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState<Color>('sand')
  const [date, setDate] = useState(today())
  const [folded, setFolded] = useState<Set<string>>(new Set())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    syncToVPS(STORAGE_KEY)
  }, [items])

  function openNew() {
    setEditingId(null); setText(''); setColor('sand'); setDate(today()); setShowForm(true)
  }
  function openEdit(r: Reminder) {
    setEditingId(r.id); setText(r.text); setColor(r.color); setDate(r.date); setShowForm(true)
  }
  function save() {
    if (!text.trim()) return
    if (editingId !== null) {
      setItems(p => p.map(r => r.id === editingId ? { ...r, text: text.trim(), color, date } : r))
    } else {
      setItems(p => [...p, { id: Date.now(), text: text.trim(), color, date, done: false }])
    }
    setShowForm(false); setEditingId(null)
  }
  function toggle(id: number) { setItems(p => p.map(r => r.id === id ? { ...r, done: !r.done } : r)) }
  function remove(id: number) {
    if (window.confirm('删除这条待办？')) setItems(p => p.filter(r => r.id !== id))
  }
  function toggleMonth(key: string) {
    setFolded(p => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  // 按时间排序（改了时间会自动归位），再按月分组
  const sorted = [...items].sort((a, b) => a.date === b.date ? a.id - b.id : (a.date < b.date ? -1 : 1))
  const groups: { key: string; label: string; list: Reminder[] }[] = []
  for (const r of sorted) {
    const key = r.date.slice(0, 7)
    let g = groups.find(x => x.key === key)
    if (!g) {
      const [y, m] = key.split('-')
      g = { key, label: `${y} · ${MONTH_NAMES[parseInt(m, 10) - 1]}`, list: [] }
      groups.push(g)
    }
    g.list.push(r)
  }

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay-dark" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(11px + env(safe-area-inset-top, 0px)) 24px 11px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(var(--ink),0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(var(--ink),0.88)' }}>reminders</span>
          <button onClick={() => showForm ? setShowForm(false) : openNew()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'rgba(var(--ink),0.7)', transform: showForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</button>
        </div>

        {/* 新增 / 编辑窗口：从顶端展开，像开一页新的 */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="glass" style={{ margin: '12px 16px', borderRadius: 16, padding: 16, overflow: 'hidden' }}>
              <p style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(var(--ink),0.4)', fontStyle: 'italic', marginBottom: 8 }}>
                {editingId !== null ? 'edit' : 'new'}
              </p>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="要记着的事…" rows={2} autoFocus
                style={{ width: '100%', background: 'rgba(var(--ink),0.08)', border: '0.5px solid rgba(var(--ink),0.15)', borderRadius: 10, padding: '8px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'rgba(var(--ink),0.88)', outline: 'none', resize: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                {(Object.keys(COLORS) as Color[]).map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: COLORS[c].dot, border: color === c ? '2px solid rgba(var(--ink),0.8)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ marginLeft: 'auto', background: 'rgba(var(--ink),0.08)', border: '0.5px solid rgba(var(--ink),0.15)', borderRadius: 8, padding: '4px 8px', fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: 'rgba(var(--ink),0.7)', outline: 'none' }} />
              </div>
              <button onClick={save} style={{ marginTop: 12, width: '100%', background: 'rgba(var(--ink),0.15)', border: '0.5px solid rgba(var(--ink),0.2)', borderRadius: 10, padding: 8, fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'rgba(var(--ink),0.88)', cursor: 'pointer', letterSpacing: 2 }}>
                {editingId !== null ? 'save' : 'add'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px', scrollbarWidth: 'none' }}>
          {groups.map(g => (
            <div key={g.key} style={{ marginBottom: 6 }}>
              {/* 月份栏：点击折叠 */}
              <button onClick={() => toggleMonth(g.key)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px 8px' }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, letterSpacing: 3, color: 'rgba(var(--ink),0.5)', fontStyle: 'italic' }}>{g.label}</span>
                <span style={{ flex: 1, height: 0.5, background: 'rgba(var(--ink),0.15)' }} />
                <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', letterSpacing: 1 }}>
                  {g.list.filter(r => r.done).length}/{g.list.length}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(var(--ink),0.4)' }}>{folded.has(g.key) ? '▸' : '▾'}</span>
              </button>
              <AnimatePresence initial={false}>
                {!folded.has(g.key) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                    {g.list.map(r => (
                      <div key={r.id}
                        style={{ background: COLORS[r.color].bg, border: `0.5px solid ${COLORS[r.color].border}`, borderRadius: 14, padding: '11px 13px', marginBottom: 8, opacity: r.done ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                          {/* 空圈圈：按下即完成 */}
                          <button onClick={() => toggle(r.id)} title={r.done ? '标回未完成' : '完成'}
                            style={{ width: 19, height: 19, borderRadius: '50%', flexShrink: 0, marginTop: 2, cursor: 'pointer',
                              border: `1.5px solid ${COLORS[r.color].dot}`,
                              background: r.done ? COLORS[r.color].dot : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, color: 'rgba(0,0,0,0.45)', lineHeight: 1, padding: 0, transition: 'background 0.2s' }}>
                            {r.done ? '✓' : ''}
                          </button>
                          {/* 点文字进入编辑 */}
                          <p onClick={() => openEdit(r)}
                            style={{ flex: 1, fontSize: 15, lineHeight: 1.65, cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif",
                              color: r.done ? 'rgba(var(--ink),0.45)' : 'rgba(var(--ink),0.88)', transition: 'color 0.3s' }}>
                            {r.text}
                          </p>
                          <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.35, color: 'rgba(var(--ink),0.8)', padding: '0 2px' }}>×</button>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(var(--ink),0.4)', marginTop: 5, marginLeft: 30, letterSpacing: 1, fontStyle: 'italic' }}>{r.date}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {items.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(var(--ink),0.25)', fontStyle: 'italic', fontSize: 14, marginTop: 60, letterSpacing: 2 }}>nothing yet</p>}
        </div>
      </div>
      <BottomNav current="reminders" onNavigate={onNavigate} />
    </div>
  )
}
