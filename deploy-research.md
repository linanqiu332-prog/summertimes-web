# Summertimes 部署调研报告
_Sprint 3 产出 · Sprint 4 执行_

---

## 结论（先看这里）

**推荐：Tailscale + 本机常驻**

理由：零运维成本，延迟最低，数据不离开自己的机器，免费额度够用。  
前提：MacBook M5 Pro 需要保持开机或长时间联网。如果需要 24h 无人值守在线，再考虑 VPS。

---

## 方案对比

### 方案 A：Tailscale（推荐）

**原理**  
Tailscale 在设备间建立 WireGuard 加密隧道，手机和 Mac 加入同一 tailnet，手机直接访问 `mac.tail…:3000`，bridge.py 跑在 Mac 本地。

**优点**
- 免费 tier：最多 3 台设备，完全够用
- 零暴露公网，安全性最高
- 延迟极低（P2P 直连，没有中转服务器跳转）
- 数据（OmbreBrain、localStorage）全留在本机
- 部署步骤极简：`brew install tailscale && tailscale up`，手机装 App，两端登同一账号即完成

**缺点**
- MacBook 必须开机且联网
- 睡眠/断网时手机访问失败
- 需要 Mac 常驻 `npm run dev` 或打包后 serve

**月费**：$0

---

### 方案 B：云服务器（VPS）

**代表选项**  
- 腾讯云轻量应用服务器 2核2G，约 ¥50/月  
- Hetzner CX22（德/芬/美），€4.5/月（~¥35），性能更好  
- Railway / Render 免费 tier（冷启动延迟高，不适合实时 bridge）

**优点**
- 24h 在线，不依赖 Mac 开机
- 可以绑定域名 + HTTPS，未来分享给第三方

**缺点**
- OmbreBrain（Docker + 向量数据库）需要迁移到服务器
- `.env`（API key、ElevenLabs key）需要妥善管理
- 轻量服务器内存 2G 跑 OmbreBrain + bridge + vite serve 偏紧
- 每月有成本，且需要 SSH 运维

**月费**：¥35–50

---

### 方案 C：Cloudflare Tunnel（折中）

Mac 本地跑所有服务，Cloudflare 免费 tunnel 把 `localhost:3000` 暴露为公网 HTTPS URL，手机直接访问域名。

**优点**
- 免费，不用 VPS
- 可以绑定自己的域名

**缺点**
- 仍然依赖 Mac 开机
- 流量过 Cloudflare 服务器（有隐私成本）
- 配置比 Tailscale 稍复杂

---

## Sprint 4 执行步骤（Tailscale 方案）

```
1. Mac 安装 Tailscale
   brew install tailscale
   sudo tailscale up

2. 手机安装 Tailscale App，同账号登录

3. 查看 Mac 在 tailnet 里的 IP
   tailscale ip -4   # 例：100.x.x.x

4. 修改手机 .env（或 vite 配置）
   VITE_BRIDGE_URL=http://100.x.x.x:8888
   VITE_API_URL=https://api.apiyi.com/v1/chat/completions

5. Mac 常驻启动脚本（可选，加进 launchd）
   cd ~/summertimes-web && npm run dev &
   cd ~/ombre-brain && python bridge.py &

6. 测试：手机浏览器访问 http://100.x.x.x:5173
```

---

## 如果后来决定上 VPS

迁移路径：  
`本机 OmbreBrain Docker` → `VPS Docker Compose`，bridge.py 同步迁移，`.env` 用 `doppler` 或直接 VPS 环境变量管理。前端可部署到 Vercel（静态），bridge 留 VPS。

---

_报告完。Sprint 4 开始前确认 MacBook 开机习惯再定方案。_
