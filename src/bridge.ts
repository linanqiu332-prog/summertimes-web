// bridge.py 地址 —— 运行时按 host 决定，不依赖 build 时的 .env。
//
// 为什么不用 import.meta.env.VITE_BRIDGE_URL：
// 该值在 build 时被烤进静态文件。手机 PWA 打开线上站时若烤进的是
// localhost:8888，请求会打到手机自己（不存在的服务），同步全挂。
//
// 规则：
//   - 本地开发（localhost / 127.0.0.1）→ 直连 bridge.py
//   - 其它任何 host（线上 / 手机）→ 相对 /api，由 nginx 反代到 :8888
//     （nginx: location /api/ { proxy_pass http://localhost:8888/; } 会 strip /api 前缀）
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isLocal = host === 'localhost' || host === '127.0.0.1'

export const BRIDGE = isLocal
  ? (import.meta.env.VITE_BRIDGE_URL || 'http://localhost:8888')
  : '/api'
