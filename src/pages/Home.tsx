import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow'

const NAV = [
  { key: 'chat', label: 'chat', icon: '✦' },
  { key: 'memories', label: 'memories', icon: '◈' },
  { key: 'diary', label: 'diary', icon: '◻' },
  { key: 'reminders', label: 'reminders', icon: '◇' },
  { key: 'tokenflow', label: 'token flow', icon: '◎' },
]

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

const ANNIVERSARY = new Date('2025-05-10')

function getCountdown() {
  const today = new Date()
  const next = new Date(ANNIVERSARY)
  next.setFullYear(today.getFullYear())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const days = Math.floor((today.getTime() - ANNIVERSARY.getTime()) / (1000 * 60 * 60 * 24))
  return { daysToNext: diff, daysTogether: days }
}

export default function Home({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [time, setTime] = useState('')
  const [active, setActive] = useState<Page>('chat')

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
  const { daysTogether } = getCountdown()

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
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
            borderRadius: 16, padding: '16px 32px',
            textAlign: 'center', minWidth: 200,
          }}
        >
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontStyle: 'italic', marginBottom: 6 }}>
            在一起
          </p>
          <p style={{ fontSize: 40, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: 2, lineHeight: 1 }}>
            {daysTogether}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontStyle: 'italic', marginTop: 6 }}>
            days
          </p>
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
          background: 'linear-gradient(to top, rgba(50,65,75,0.5), transparent)',
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
