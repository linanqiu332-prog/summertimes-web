import { motion } from 'framer-motion'
import Icon, { type IconName } from './Icon'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const NAV: { key: string; icon: IconName; label: string }[] = [
  { key: 'home',      icon: 'home',      label: 'home' },
  { key: 'memories',  icon: 'memories',  label: 'memories' },
  { key: 'snippets',  icon: 'snippets',  label: 'snippets' },
  { key: 'letters',   icon: 'letters',   label: 'letters' },
  { key: 'reminders', icon: 'reminders', label: 'remind' },
  { key: 'tokenflow', icon: 'tokens',    label: 'tokens' },
  { key: 'persona',   icon: 'persona',   label: 'persona' },
]

export default function BottomNav({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 100,
      background: 'rgba(var(--veil),0.55)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '0.5px solid rgba(var(--ink),0.1)',
      padding: '7px 6px calc(7px + env(safe-area-inset-bottom, 0px))',
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
                padding: '3px 7px',
                color: active ? 'rgba(var(--ink),0.95)' : 'rgba(var(--ink),0.4)',
                transition: 'color 0.2s',
              }}
            >
              <Icon name={item.icon} size={19} />
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 8, letterSpacing: 1.2,
                color: active ? 'rgba(var(--ink),0.8)' : 'rgba(var(--ink),0.32)',
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
            padding: '3px 7px',
            color: 'rgba(var(--ink),0.4)',
          }}
        >
          <Icon name="ombre" size={19} />
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 8, letterSpacing: 1.2,
            color: 'rgba(var(--ink),0.32)',
          }}>
            ombre
          </span>
        </motion.button>
      </div>
    </div>
  )
}
