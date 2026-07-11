// 跨设备 localStorage 同步工具
// 所有需要多端共享的 key 都走这里

import { BRIDGE } from './bridge'

// 同步的 key 列表
export const SYNC_KEYS = [
  'summertimes_tokens',
  'summertimes_snippets',
  'summertimes_letters',
  'summertimes_countdowns',
  'summertimes_diary',
  'summertimes_reminders',
  'summertimes_persona',      // wake.py 自主唤醒时要在 VPS 上读人设
  'summertimes_persona_eve',
  'summertimes_engine',       // 模型/上下文/桶数设置，多端同步
  'summertimes_plans',        // 承诺镜像：OB的plan只写不读，随身清单存这里
]

// 从 VPS 拉全部数据，写入 localStorage，再把本地数据推回 VPS
// 顺序：① VPS → 本地（VPS 优先）② 本地 → VPS（保持 VPS 最新）
export async function syncFromVPS(): Promise<void> {
  try {
    const r = await fetch(`${BRIDGE}/store`)
    if (!r.ok) return
    const vps: Record<string, unknown> = await r.json()

    // ① VPS 有数据的 key → 写入本地
    for (const key of SYNC_KEYS) {
      if (key in vps && vps[key] !== null) {
        localStorage.setItem(key, JSON.stringify(vps[key]))
      }
    }

    // ② 把所有本地数据推到 VPS（含冷启动上传 + 让 VPS 保持最新）
    await Promise.all(SYNC_KEYS.map(key => syncToVPS(key)))
  } catch {}
}

// 把某个 key 推到 VPS
export async function syncToVPS(key: string): Promise<void> {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return
    await fetch(`${BRIDGE}/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data: JSON.parse(raw) }),
    })
  } catch {}
}
