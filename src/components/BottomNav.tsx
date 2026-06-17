import { motion } from 'framer-motion'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const NAV = [
  { key: 'home',      icon: '⌂', label: 'home' },
  { key: 'memories',  icon: '◈', label: 'memories' },
  { key: 'snippets',  icon: '✦', label: 'snippets' },
  { key: 'letters',   icon: '✉', label: 'letters' },
  { key: 'reminders', icon: '◇', label: 'remind' },
  { key: 'tokenflow', icon: '◎', label: 'tokens' },
  { key: 'persona',   icon: '◉', label: 'persona' },
]

export default function BottomNav({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 100,
      background: 'rgba(60,75,85,0.45)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '0.5px solid rgba(255,255,255,0.1)',
      padding: '10px 4px calc(16px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      }}>
        {NAV.map(item => {
          const active = current === item.key
          return (
            <motion.button
              key={item.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate(item.key as Page)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '4px 8px',
              }}
            >
              <span style={{
                fontSize: 16,
                color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.38)',
                transition: 'color 0.2s',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 8, letterSpacing: 1.2,
                color: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.2s',
              }}>
                {item.label}
              </span>
            </motion.button>
          )
        })}

        {/* OmbreBrain 外链入口 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => window.open('https://ombre.summertimes.app', '_blank')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '4px 8px',
          }}
        >
          <span style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.38)',
            transition: 'color 0.2s',
          }}>
            ⬡
          </span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 8, letterSpacing: 1.2,
            color: 'rgba(255,255,255,0.3)',
            transition: 'color 0.2s',
          }}>
            ombre
          </span>
        </motion.button>
      </div>
    </div>
  )
}
