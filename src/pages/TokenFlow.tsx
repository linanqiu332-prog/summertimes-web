import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import BottomNav from '../components/BottomNav'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'
type DayLog = Record<string, number>

export default function TokenFlow({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [log, setLog] = useState<DayLog>({})
  const [sessionTokens, setSessionTokens] = useState(0)
  const [price, setPrice] = useState<number>(() => parseFloat(localStorage.getItem('summertimes_price_per_m') || '0'))
  const [editingPrice, setEditingPrice] = useState(false)

  function savePrice(v: string) {
    const n = parseFloat(v)
    const ok = !isNaN(n) && n >= 0 ? n : 0
    setPrice(ok)
    localStorage.setItem('summertimes_price_per_m', String(ok))
    setEditingPrice(false)
  }

  const cost = (tokens: number) => price > 0 ? `¥${((tokens / 1_000_000) * price).toFixed(2)}` : ''

  useEffect(() => {
    const raw = localStorage.getItem('summertimes_tokens')
    if (raw) setLog(JSON.parse(raw))
    const msgs = JSON.parse(localStorage.getItem('summertimes_messages') || '[]')
    const est = msgs.reduce((acc: number, m: any) => acc + Math.ceil((m.text?.length || 0) / 4), 0)
    setSessionTokens(est)
  }, [])

  const today = new Date().toDateString()
  const todayTokens = log[today] || 0
  const totalTokens = Object.values(log).reduce((a, b) => a + b, 0)
  const days = Object.entries(log).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).slice(0, 14)
  const maxVal = Math.max(...days.map(d => d[1]), 1)

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>token flow</span>
          <span style={{ width: 24 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', scrollbarWidth: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
            {[
              { label: 'today', value: todayTokens.toLocaleString(), cost: cost(todayTokens) },
              { label: 'session', value: sessionTokens.toLocaleString(), cost: cost(sessionTokens) },
              { label: 'total', value: totalTokens.toLocaleString(), cost: cost(totalTokens) },
            ].map(c => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass" style={{ borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontStyle: 'italic', marginBottom: 6 }}>{c.label}</p>
                <p style={{ fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>{c.value}</p>
                {c.cost && <p style={{ fontSize: 11, color: 'rgba(180,210,200,0.65)', letterSpacing: 1, marginTop: 4 }}>{c.cost}</p>}
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {editingPrice ? (
              <input autoFocus defaultValue={price || ''} placeholder="0.00" inputMode="decimal"
                onBlur={e => savePrice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePrice((e.target as HTMLInputElement).value) }}
                style={{ width: 120, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '5px 12px', fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: 'rgba(255,255,255,0.9)', outline: 'none', textAlign: 'center' }} />
            ) : (
              <button onClick={() => setEditingPrice(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>
                {price > 0 ? `¥${price} / 1M tokens · 估算 · 点击修改` : '点击设置单价（¥/1M tokens）开启费用估算'}
              </button>
            )}
          </div>

          <div className="glass" style={{ borderRadius: 16, padding: '20px 16px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontStyle: 'italic', marginBottom: 16 }}>recent 14 days</p>
            {days.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: 13, letterSpacing: 2, textAlign: 'center', padding: '20px 0' }}>no data yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {days.map(([date, count]) => {
                  const d = new Date(date)
                  const label = `${d.getMonth() + 1}/${d.getDate()}`
                  const pct = (count / maxVal) * 100
                  return (
                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 32, flexShrink: 0, letterSpacing: 1 }}>{label}</span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                          style={{ height: '100%', background: 'rgba(200,215,225,0.6)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 44, textAlign: 'right', letterSpacing: 1 }}>{count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginTop: 20, fontFamily: 'monospace' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginBottom: 10 }}>— log —</p>
            {days.slice(0, 7).map(([date, count]) => (
              <div key={date} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{new Date(date).toLocaleDateString()}</span>
                <span style={{ fontSize: 11, color: 'rgba(180,210,200,0.7)' }}>+{count.toLocaleString()} tokens{price > 0 ? ` · ${cost(count)}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav current="tokenflow" onNavigate={onNavigate} />
    </div>
  )
}
