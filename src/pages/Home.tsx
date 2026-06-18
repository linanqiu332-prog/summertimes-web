import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { syncToVPS } from '../sync'
type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const NAV = [
  { key: 'chat', label: 'chat', icon: '✦' },
  { key: 'memories', label: 'memories', icon: '◈' },
  { key: 'snippets', label: 'snippets', icon: '✧' },
  { key: 'letters', label: 'letters', icon: '✉' },
  { key: 'diary', label: 'diary', icon: '◻' },
  { key: 'reminders', label: 'reminders', icon: '◇' },
  { key: 'tokenflow', label: 'token flow', icon: '◎' },
  { key: 'persona', label: 'persona', icon: '◉' },
]

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

type CD = { id: number; name: string; date: string }
const CD_KEY = 'summertimes_countdowns'

function loadCDs(): CD[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CD_KEY) || 'null')
    if (Array.isArray(raw) && raw.length) return raw
  } catch { /* noop */ }
  return [{ id: 1, name: '在一起', date: '2026-05-10' }]
}

// 过去的日期 → 已经多少天；未来的日期 → 还剩多少天
function daysOf(date: string): { n: number; future: boolean } {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  return diff > 0 ? { n: diff, future: true } : { n: -diff, future: false }
}

export default function Home({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [time, setTime] = useState('')
  const [active, setActive] = useState<Page>('chat')
  const [cds, setCds] = useState<CD[]>(loadCDs)

  function persistCds(next: CD[]) {
    setCds(next)
    localStorage.setItem(CD_KEY, JSON.stringify(next))
    syncToVPS(CD_KEY)
  }

  function addCd() {
    const name = window.prompt('名字（比如：求婚 / 下次见面）')?.trim()
    if (!name) return
    const date = window.prompt('日期（YYYY-MM-DD）')?.trim() || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      window.alert('日期格式不对，要 YYYY-MM-DD，比如 2026-07-01')
      return
    }
    persistCds([...cds, { id: Date.now(), name, date }])
  }

  function delCd(c: CD) {
    if (cds.length > 1 && window.confirm(`删除「${c.name}」？`)) persistCds(cds.filter(x => x.id !== c.id))
  }

  useEffect(() => {
    function tick() {
      const d = new Date()
      const h = d.getHours() % 12 || 12
      const m = d.getMinutes().toString().padStart(2, '0')
      setTime(`${h}:${m}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
  const primary = cds[0]
  const rest = cds.slice(1)

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" />
      <div className="overlay" />

      {/* 主体 80% */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          position: 'absolute', inset: 0, bottom: '20%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 2, padding: '0 32px',
        }}
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 13, color: 'rgba(255,255,255,0.5)',
            letterSpacing: 4, alignSelf: 'flex-start',
            marginBottom: 'auto', marginTop: 48,
          }}
        >
          {time}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(28px, 6vw, 48px)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Summertimes
          </h1>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 13, fontStyle: 'italic',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.16em',
          }}>
            {dateStr}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass"
          style={{
            borderRadius: 16, padding: '16px 24px',
            textAlign: 'center', minWidth: 220,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontStyle: 'italic' }}>
              {primary.name}
            </span>
            <button onClick={addCd} title="添加倒计时"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1, padding: 0 }}>+</button>
          </div>
          <p style={{ fontSize: 40, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: 2, lineHeight: 1 }}>
            {daysOf(primary.date).n}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontStyle: 'italic', marginTop: 6 }}>
            days
          </p>
          {rest.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.15)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {rest.map(c => {
                const d = daysOf(c.date)
                return (
                  <div key={c.id} onDoubleClick={() => delCd(c)} title="双击删除"
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 28, fontSize: 12.5, letterSpacing: 1 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{c.name}</span>
                    <span style={{ color: d.future ? 'rgba(200,225,215,0.85)' : 'rgba(255,255,255,0.65)' }}>
                      {d.future ? `${d.n}d 后` : `${d.n}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* 导航 20% */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '22%', zIndex: 3,
          display: 'flex', alignItems: 'center',
          padding: '0 20px 24px',
          background: 'linear-gradient(to top, rgba(20,17,14,0.55), transparent)',
        }}
      >
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          width: '100%', paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          {NAV.map(item => (
            <motion.button
              key={item.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActive(item.key as Page)
                onNavigate(item.key as Page)
              }}
              style={{
                flexShrink: 0,
                background: active === item.key ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.12)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 24,
                padding: '10px 20px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                fontSize: 16,
                color: active === item.key ? '#3d4a52' : 'rgba(255,255,255,0.8)',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 11, letterSpacing: 2,
                color: active === item.key ? '#3d4a52' : 'rgba(255,255,255,0.65)',
              }}>
                {item.label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
