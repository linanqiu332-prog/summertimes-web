// 引擎设置：模型 / 聊天上下文条数 / breath 记忆桶数
// TokenFlow 页改，Chat 页每次发消息时现读——改完下一条消息即生效
import { syncToVPS } from './sync'

export const ENGINE_KEY = 'summertimes_engine'

export type Engine = { model: string; ctx: number; buckets: number }

export const ENGINE_DEFAULT: Engine = { model: 'claude-sonnet-4-6', ctx: 30, buckets: 20 }

export const MODEL_PRESETS = [
  { id: 'claude-sonnet-4-6', label: 'sonnet 4.6 · 均衡（默认）' },
  { id: 'claude-opus-4-8', label: 'opus 4.8 · 更聪明更贵' },
  { id: 'claude-fable-5', label: 'fable 5 · 最强最烧钱' },
  { id: 'claude-haiku-4-5', label: 'haiku 4.5 · 快而省' },
]

// 单价（$ / 1M tokens），照 apiyi 价目表抄的；cache 读按输入价 1 折（Anthropic 惯例）
export type Price = { in: number; out: number; cache: number }
const PRICES: Record<string, Price> = {
  'claude-sonnet-4-6':        { in: 3,  out: 15, cache: 0.3 },
  'claude-haiku-4-5':         { in: 1,  out: 5,  cache: 0.1 },
  'claude-opus-4-6':          { in: 5,  out: 25, cache: 0.5 },
  'claude-opus-4-6-thinking': { in: 5,  out: 25, cache: 0.5 },
  'claude-opus-4-7':          { in: 5,  out: 25, cache: 0.5 },
  'claude-opus-4-7-thinking': { in: 5,  out: 25, cache: 0.5 },
  'claude-opus-4-8':          { in: 5,  out: 25, cache: 0.5 },
  'claude-opus-4-8-thinking': { in: 5,  out: 15, cache: 0.5 },
  'claude-fable-5':           { in: 10, out: 50, cache: 1 },
}
// 没登记的模型按 sonnet 价兜底
export function getPrice(model: string): Price {
  return PRICES[model] || PRICES['claude-sonnet-4-6']
}

function clamp(n: number, lo: number, hi: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback
}

export function getEngine(): Engine {
  try {
    const raw = JSON.parse(localStorage.getItem(ENGINE_KEY) || '{}')
    return {
      model: (typeof raw.model === 'string' && raw.model.trim()) || ENGINE_DEFAULT.model,
      ctx: clamp(Number(raw.ctx), 10, 100, ENGINE_DEFAULT.ctx),
      buckets: clamp(Number(raw.buckets), 1, 50, ENGINE_DEFAULT.buckets),
    }
  } catch {
    return { ...ENGINE_DEFAULT }
  }
}

export function saveEngine(e: Engine): Engine {
  const cleaned: Engine = {
    model: e.model.trim() || ENGINE_DEFAULT.model,
    ctx: clamp(e.ctx, 10, 100, ENGINE_DEFAULT.ctx),
    buckets: clamp(e.buckets, 1, 50, ENGINE_DEFAULT.buckets),
  }
  localStorage.setItem(ENGINE_KEY, JSON.stringify(cleaned))
  syncToVPS(ENGINE_KEY)
  return cleaned
}
