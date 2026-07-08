import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { getEngine, saveEngine, getPrice, MODEL_PRESETS, type Engine } from '../engine'

type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'
type DayEntry = { input: number; output: number; cache: number }
type DayLog = Record<string, DayEntry>

function fmtCost(n: number) {
  if (n < 0.001) return `$${(n * 1000).toFixed(3)}m`
  return `$${n.toFixed(4)}`
}

function normEntry(raw: unknown): DayEntry {
  if (typeof raw === 'number') return { input: 0, output: raw, cache: 0 }
  const r = raw as DayEntry
  return { input: r.input || 0, output: r.output || 0, cache: r.cache || 0 }
}

function StatCard({ label, sub, value, sub2 }: { label: string; sub: string; value: string; sub2?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass" style={{ borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: 9, color: 'rgba(var(--ink),0.35)', letterSpacing: 2.5, fontStyle: 'italic' }}>{label}</p>
      <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.25)', letterSpacing: 1, fontFamily: 'monospace' }}>{sub}</p>
      <p style={{ fontSize: 20, fontWeight: 300, color: 'rgba(var(--ink),0.9)', letterSpacing: 0.5, fontFamily: 'monospace' }}>{value}</p>
      {sub2 && <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', letterSpacing: 1, fontFamily: 'monospace' }}>{sub2}</p>}
    </motion.div>
  )
}

const numInput: React.CSSProperties = {
  width: 72, background: 'rgba(var(--ink),0.08)', border: '0.5px solid rgba(var(--ink),0.15)',
  borderRadius: 8, padding: '5px 10px', fontFamily: 'monospace', fontSize: 13,
  color: 'rgba(var(--ink),0.88)', outline: 'none', textAlign: 'center',
}

export default function TokenFlow({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [log, setLog] = useState<DayLog>({})
  const [eng, setEng] = useState<Engine>(getEngine)
  const [savedTip, setSavedTip] = useState('')

  // 单价随所选模型联动（$ / token）；历史数据也按当前模型价折算，仅供参考
  const price = getPrice(eng.model)
  const INPUT_PRICE  = price.in    / 1_000_000
  const OUTPUT_PRICE = price.out   / 1_000_000
  const CACHE_PRICE  = price.cache / 1_000_000
  const toCost = (e: DayEntry) => e.input * INPUT_PRICE + e.output * OUTPUT_PRICE + e.cache * CACHE_PRICE

  function applyEngine() {
    const cleaned = saveEngine(eng)
    setEng(cleaned)
    setSavedTip('已保存，下一条消息生效')
    setTimeout(() => setSavedTip(''), 3000)
  }

  useEffect(() => {
    const raw = localStorage.getItem('summertimes_tokens')
    if (!raw) return
    const parsed = JSON.parse(raw)
    const normalized: DayLog = {}
    for (const [k, v] of Object.entries(parsed)) {
      normalized[k] = normEntry(v)
    }
    setLog(normalized)
  }, [])

  const today = new Date().toDateString()
  const todayEntry: DayEntry = log[today] || { input: 0, output: 0, cache: 0 }

  const allEntries = Object.values(log).map(normEntry)
  const totalInput  = allEntries.reduce((a, e) => a + e.input,  0)
  const totalOutput = allEntries.reduce((a, e) => a + e.output, 0)
  const totalCache  = allEntries.reduce((a, e) => a + e.cache,  0)
  const totalCost   = toCost({ input: totalInput, output: totalOutput, cache: totalCache })

  const days = Object.entries(log)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 14)
    .map(([date, raw]) => ({ date, entry: normEntry(raw) }))

  const maxTotal = Math.max(...days.map(d => d.entry.input + d.entry.output), 1)

  return (
    <div className="safe-screen" style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <div className="bg" /><div className="overlay-dark" />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

        {/* header */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(11px + env(safe-area-inset-top, 0px)) 24px 11px', borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'rgba(var(--ink),0.7)', lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, letterSpacing: 4, color: 'rgba(var(--ink),0.88)' }}>token flow</span>
          <span style={{ width: 24 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', scrollbarWidth: 'none' }}>

          {/* engine settings：模型 / 上下文条数 / 记忆桶数 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass" style={{ borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.3)', letterSpacing: 3, marginBottom: 14, fontFamily: 'monospace' }}>engine</p>

            <p style={{ fontSize: 12, color: 'rgba(var(--ink),0.5)', letterSpacing: 1.5, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", marginBottom: 8 }}>模型</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {MODEL_PRESETS.map(m => (
                <button key={m.id} onClick={() => setEng({ ...eng, model: m.id })}
                  style={{ background: eng.model === m.id ? 'rgba(var(--ink),0.18)' : 'rgba(var(--ink),0.05)',
                    border: `0.5px solid rgba(var(--ink),${eng.model === m.id ? '0.35' : '0.12'})`,
                    borderRadius: 14, padding: '5px 12px', cursor: 'pointer',
                    fontFamily: 'monospace', fontSize: 11, color: 'rgba(var(--ink),0.75)' }}>
                  {m.label}
                </button>
              ))}
            </div>
            <input value={eng.model} onChange={e => setEng({ ...eng, model: e.target.value })}
              placeholder="或手填模型 id"
              style={{ width: '100%', background: 'rgba(var(--ink),0.06)', border: '0.5px solid rgba(var(--ink),0.12)',
                borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace', fontSize: 12,
                color: 'rgba(var(--ink),0.7)', outline: 'none', marginBottom: 14 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 12, color: 'rgba(var(--ink),0.5)', letterSpacing: 1.5, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>聊天上下文条数</p>
                <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.3)', fontFamily: 'monospace', marginTop: 2 }}>10–100 · 他随身带的"刚才"</p>
              </div>
              <input type="number" min={10} max={100} value={eng.ctx}
                onChange={e => setEng({ ...eng, ctx: Number(e.target.value) })} style={numInput} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: 'rgba(var(--ink),0.5)', letterSpacing: 1.5, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>记忆桶数</p>
                <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.3)', fontFamily: 'monospace', marginTop: 2 }}>1–50 · 每次 breath 浮上来的"从前"</p>
              </div>
              <input type="number" min={1} max={50} value={eng.buckets}
                onChange={e => setEng({ ...eng, buckets: Number(e.target.value) })} style={numInput} />
            </div>

            <button onClick={applyEngine}
              style={{ width: '100%', background: 'rgba(var(--ink),0.15)', border: '0.5px solid rgba(var(--ink),0.2)',
                borderRadius: 10, padding: 8, fontFamily: "'Cormorant Garamond', serif", fontSize: 14,
                color: 'rgba(var(--ink),0.88)', cursor: 'pointer', letterSpacing: 2 }}>
              {savedTip || 'save'}
            </button>
            <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.28)', fontFamily: 'monospace', marginTop: 8, lineHeight: 1.6 }}>
              注：下方计费随所选模型联动（当前 ${price.in}/${price.out} per 1M）。历史天数是混着不同模型跑的，折算仅供参考。换模型后缓存会重写一次。
            </p>
          </motion.div>

          {/* pricing legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(180,210,200,0.7)', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', letterSpacing: 0.5 }}>input ${price.in}/M</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(210,190,155,0.7)', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', letterSpacing: 0.5 }}>output ${price.out}/M</span>
            </div>
            {totalCache > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(180,180,210,0.5)', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', letterSpacing: 0.5 }}>cache ${price.cache}/M</span>
              </div>
            )}
          </div>

          {/* today console block */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass" style={{ borderRadius: 16, padding: '18px 16px', marginBottom: 16, fontFamily: 'monospace' }}>
            <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.3)', letterSpacing: 3, marginBottom: 14 }}>today</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(180,210,200,0.6)', width: 14 }}>↑</span>
                <span style={{ fontSize: 11, color: 'rgba(var(--ink),0.5)' }}>input</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'rgba(180,210,200,0.85)' }}>{todayEntry.input.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: 'rgba(180,210,200,0.4)' }}>{fmtCost(todayEntry.input * INPUT_PRICE)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(210,190,155,0.6)', width: 14 }}>↓</span>
                <span style={{ fontSize: 11, color: 'rgba(var(--ink),0.5)' }}>output</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'rgba(210,190,155,0.85)' }}>{todayEntry.output.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: 'rgba(210,190,155,0.4)' }}>{fmtCost(todayEntry.output * OUTPUT_PRICE)}</span>
              </div>

              {todayEntry.cache > 0 && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(180,180,210,0.5)', width: 14 }}>⚡</span>
                  <span style={{ fontSize: 11, color: 'rgba(var(--ink),0.5)' }}>cache</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'rgba(180,180,210,0.7)' }}>{todayEntry.cache.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: 'rgba(180,180,210,0.35)' }}>{fmtCost(todayEntry.cache * CACHE_PRICE)}</span>
                </div>
              </>)}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(var(--ink),0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.3)', letterSpacing: 2 }}>total cost</span>
              <span style={{ fontSize: 18, color: 'rgba(var(--ink),0.85)', fontWeight: 300 }}>{fmtCost(toCost(todayEntry))}</span>
            </div>
          </motion.div>

          {/* cumulative stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <StatCard
              label="input · all time"
              sub={`@ $${price.in} / 1M`}
              value={totalInput > 999999 ? `${(totalInput/1e6).toFixed(2)}M` : totalInput.toLocaleString()}
              sub2={fmtCost(totalInput * INPUT_PRICE)}
            />
            <StatCard
              label="output · all time"
              sub={`@ $${price.out} / 1M`}
              value={totalOutput > 999999 ? `${(totalOutput/1e6).toFixed(2)}M` : totalOutput.toLocaleString()}
              sub2={fmtCost(totalOutput * OUTPUT_PRICE)}
            />
            {totalCache > 0 && (
              <StatCard
                label="cache · all time"
                sub={`@ $${price.cache} / 1M`}
                value={totalCache > 999999 ? `${(totalCache/1e6).toFixed(2)}M` : totalCache.toLocaleString()}
                sub2={fmtCost(totalCache * CACHE_PRICE)}
              />
            )}
            <StatCard
              label="total spent"
              sub="input + output + cache"
              value={fmtCost(totalCost)}
            />
          </div>

          {/* stacked bar chart */}
          <div className="glass" style={{ borderRadius: 16, padding: '20px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: 'rgba(var(--ink),0.4)', letterSpacing: 3, fontStyle: 'italic', marginBottom: 16 }}>recent 14 days</p>
            {days.length === 0 ? (
              <p style={{ color: 'rgba(var(--ink),0.25)', fontStyle: 'italic', fontSize: 13, letterSpacing: 2, textAlign: 'center', padding: '20px 0' }}>no data yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {days.map(({ date, entry }) => {
                  const d = new Date(date)
                  const label = `${d.getMonth() + 1}/${d.getDate()}`
                  const inPct  = (entry.input  / maxTotal) * 100
                  const outPct = (entry.output / maxTotal) * 100
                  const cost   = toCost(entry)
                  return (
                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'rgba(var(--ink),0.4)', width: 32, flexShrink: 0, letterSpacing: 1 }}>{label}</span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(var(--ink),0.08)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${inPct}%` }} transition={{ duration: 0.6 }}
                          style={{ height: '100%', background: 'rgba(180,210,200,0.65)', borderRadius: '3px 0 0 3px', flexShrink: 0 }} />
                        <motion.div initial={{ width: 0 }} animate={{ width: `${outPct}%` }} transition={{ duration: 0.6, delay: 0.1 }}
                          style={{ height: '100%', background: 'rgba(210,190,155,0.65)', flexShrink: 0 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(var(--ink),0.35)', width: 52, textAlign: 'right', letterSpacing: 0.5, fontFamily: 'monospace' }}>{fmtCost(cost)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* console log */}
          <div style={{ fontFamily: 'monospace' }}>
            <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.25)', letterSpacing: 3, marginBottom: 12 }}>— console log —</p>
            {days.slice(0, 7).map(({ date, entry }) => (
              <div key={date} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(var(--ink),0.03)', borderRadius: 8, borderLeft: '2px solid rgba(var(--ink),0.08)' }}>
                <p style={{ fontSize: 10, color: 'rgba(var(--ink),0.25)', marginBottom: 5 }}>{new Date(date).toLocaleDateString()}</p>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'rgba(180,210,200,0.65)' }}>↑ {entry.input.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: 'rgba(210,190,155,0.65)' }}>↓ {entry.output.toLocaleString()}</span>
                  {entry.cache > 0 && <span style={{ fontSize: 11, color: 'rgba(180,180,210,0.5)' }}>⚡ {entry.cache.toLocaleString()}</span>}
                  <span style={{ fontSize: 11, color: 'rgba(var(--ink),0.3)' }}>{fmtCost(toCost(entry))}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
      <BottomNav current="tokenflow" onNavigate={onNavigate} />
    </div>
  )
}
