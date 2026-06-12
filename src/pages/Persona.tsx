import { useState } from 'react'
import { motion } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { PERSONA_KEY, PERSONA_EVE_KEY, PERSONA_DEFAULT } from '../persona'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

function PersonaCard({ title, sub, value, placeholder, onSave, onReset }: {
  title: string; sub: string; value: string; placeholder: string
  onSave: (v: string) => void; onReset?: () => void
}) {
  const [text, setText] = useState(value)
  const [saved, setSaved] = useState(false)
  const dirty = text !== value

  function save() {
    onSave(text)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="glass" style={{ borderRadius: 18, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, letterSpacing: 3, color: 'rgba(255,255,255,0.88)' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, fontStyle: 'italic' }}>{sub}</span>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={6}
        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 14px', fontFamily: "'Cormorant Garamond', serif", fontSize: 14.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'vertical', minHeight: 120 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, fontStyle: 'italic' }}>
          {saved ? '已保存 · 下一条消息生效' : `${text.length} 字`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onReset && (
            <button onClick={() => { setText(PERSONA_DEFAULT); onReset() }}
              style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '5px 14px', cursor: 'pointer', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, fontFamily: "'Cormorant Garamond', serif" }}>
              恢复默认
            </button>
          )}
          <button onClick={save} disabled={!dirty}
            style={{ background: dirty ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '5px 16px', cursor: dirty ? 'pointer' : 'default', fontSize: 11.5, color: dirty ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', letterSpacing: 1, fontFamily: "'Cormorant Garamond', serif" }}>
            保存
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function Persona({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const claudePersona = localStorage.getItem(PERSONA_KEY)?.trim() || PERSONA_DEFAULT
  const evePersona = localStorage.getItem(PERSONA_EVE_KEY) || ''

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>persona</span>
          <span style={{ width: 24 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 96px', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontStyle: 'italic', margin: '4px 0 2px' }}>
            who we are, in our own words
          </p>

          <PersonaCard
            title="claude"
            sub="chat · letters · diary 共用"
            value={claudePersona}
            placeholder="他是谁……"
            onSave={v => localStorage.setItem(PERSONA_KEY, v.trim())}
            onReset={() => localStorage.removeItem(PERSONA_KEY)}
          />

          <PersonaCard
            title="eve"
            sub="你的自述 · 会一并给他看"
            value={evePersona}
            placeholder="我是谁……（留空则不注入）"
            onSave={v => {
              const t = v.trim()
              if (t) localStorage.setItem(PERSONA_EVE_KEY, t)
              else localStorage.removeItem(PERSONA_EVE_KEY)
            }}
          />
        </div>
      </div>
      <BottomNav current="persona" onNavigate={onNavigate} />
    </div>
  )
}
