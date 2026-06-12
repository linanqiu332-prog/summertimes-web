import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

const BRIDGE = import.meta.env.VITE_BRIDGE_URL

type Bucket = {
  id: string
  name: string
  pinned: boolean
  topics: string
  valence: number
  arousal: number
  importance: number
  weight: number
  tags: string[]
}

type Stats = { pinned: number; dynamic: number; archived: number; size: string }

// 解析 pulse 返回的文本
function parsePulse(text: string): { stats: Stats; buckets: Bucket[] } {
  const stats: Stats = { pinned: 0, dynamic: 0, archived: 0, size: '' }
  const buckets: Bucket[] = []

  const sp = text.match(/固化记忆桶:\s*(\d+)/)
  const sd = text.match(/动态记忆桶:\s*(\d+)/)
  const sa = text.match(/归档记忆桶:\s*(\d+)/)
  const sz = text.match(/总存储大小:\s*([\d.]+\s*\S+)/)
  if (sp) stats.pinned = +sp[1]
  if (sd) stats.dynamic = +sd[1]
  if (sa) stats.archived = +sa[1]
  if (sz) stats.size = sz[1]

  const lineRe = /^(📌|💭)\s*\[(.+?)\]\s*bucket_id:(\S+)\s*主题:(\S+)\s*情感:V([\d.]+)\/A([\d.]+)\s*重要:(\d+)\s*权重:([\d.]+)\s*标签:(.*)$/
  for (const line of text.split('\n')) {
    const m = line.trim().match(lineRe)
    if (!m) continue
    buckets.push({
      pinned: m[1] === '📌',
      name: m[2],
      id: m[3],
      topics: m[4],
      valence: +m[5],
      arousal: +m[6],
      importance: +m[7],
      weight: +m[8],
      tags: m[9].split(',').map(t => t.trim()).filter(Boolean),
    })
  }
  return { stats, buckets }
}

// 分类规则（Sprint 2.1）：核心=钉选或importance≥9，长期=6-8，短期=≤5
function tierOf(b: Bucket): 'core' | 'long' | 'short' {
  if (b.pinned || b.importance >= 9) return 'core'
  if (b.importance >= 6) return 'long'
  return 'short'
}

// 权重条：对数刻度，999→满格
function weightPct(w: number): number {
  return Math.min(100, (Math.log10(w + 1) / 3) * 100)
}

const TIER_META = {
  core: { label: '核心记忆', sub: 'pinned · 永不衰减' },
  long: { label: '长期记忆', sub: 'importance 6–8' },
  short: { label: '短期记忆', sub: '随时间衰减' },
} as const

function BucketCard({ b, onPin, onDelete }: { b: Bucket; onPin: (b: Bucket) => void; onDelete: (b: Bucket) => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="glass" style={{ borderRadius: 16, padding: '12px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {b.name}
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onPin(b)} title={b.pinned ? '取消钉选' : '钉选'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: b.pinned ? 1 : 0.35 }}>📌</button>
          <button onClick={() => onDelete(b)} title="删除"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>✕</button>
        </div>
      </div>

      {/* 权重条 */}
      <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${weightPct(b.weight)}%` }} transition={{ duration: 0.6 }}
          style={{ height: '100%', borderRadius: 2, background: b.pinned ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
        <span>重要 {b.importance}</span>
        <span>权重 {b.weight >= 999 ? '∞' : b.weight.toFixed(1)}</span>
        <span>V{b.valence} · A{b.arousal}</span>
      </div>

      {b.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {b.tags.slice(0, 5).map(t => (
            <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
              {t}
            </span>
          ))}
          {b.tags.length > 5 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>+{b.tags.length - 5}</span>}
        </div>
      )}
    </motion.div>
  )
}

export default function Memories({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${BRIDGE}/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      const text = d?.result?.content?.[0]?.text || ''
      const parsed = parsePulse(text)
      setBuckets(parsed.buckets)
      setStats(parsed.stats)
    } catch {
      setError('bridge 没有响应——检查 bridge.py 跑没跑（localhost:8888）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function trace(body: Record<string, unknown>) {
    try {
      await fetch(`${BRIDGE}/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await load()
    } catch {
      setError('trace 调用失败')
    }
  }

  const onPin = (b: Bucket) => trace({ bucket_id: b.id, pinned: b.pinned ? 0 : 1 })
  const onDelete = (b: Bucket) => {
    if (window.confirm(`确定删除「${b.name}」？这条记忆会永久消失。`)) trace({ bucket_id: b.id, delete: true })
  }

  const tiers = (['core', 'long', 'short'] as const).map(t => ({
    key: t,
    ...TIER_META[t],
    items: buckets.filter(b => tierOf(b) === t).sort((a, b) => b.weight - a.weight),
  }))

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(255,255,255,0.88)' }}>memories</span>
          <button onClick={load} disabled={loading} title="刷新"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.45)', opacity: loading ? 0.3 : 1 }}>↻</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 96px', scrollbarWidth: 'none' }}>

          {stats && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 24, fontSize: 11.5, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, fontStyle: 'italic' }}>
              <span>钉选 {stats.pinned}</span>
              <span>动态 {stats.dynamic}</span>
              <span>归档 {stats.archived}</span>
              {stats.size && <span>{stats.size}</span>}
            </motion.div>
          )}

          {loading && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 14, marginTop: 60, letterSpacing: 2 }}>把脉中…</p>
          )}

          {error && !loading && (
            <p style={{ textAlign: 'center', color: 'rgba(255,180,170,0.6)', fontStyle: 'italic', fontSize: 13, marginTop: 60, letterSpacing: 1 }}>{error}</p>
          )}

          {!loading && !error && tiers.map(tier => (
            tier.items.length > 0 && (
              <div key={tier.key} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, paddingLeft: 2 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, letterSpacing: 3, color: 'rgba(255,255,255,0.85)' }}>{tier.label}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, fontStyle: 'italic' }}>{tier.sub} · {tier.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <AnimatePresence>
                    {tier.items.map(b => <BucketCard key={b.id} b={b} onPin={onPin} onDelete={onDelete} />)}
                  </AnimatePresence>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
      <BottomNav current="memories" onNavigate={onNavigate} />
    </div>
  )
}
