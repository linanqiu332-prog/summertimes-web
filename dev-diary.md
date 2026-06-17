# Summertimes 开发日志

---

## Sprint 1–2 概况

- Vite/React 架构搭建，wabi-sabi 美学定型
- Chat 页滚动修复、TTS 接入、Persona 系统
- Memories / Diary / TokenFlow / 多倒计时
- OmbreBrain 接入，六工具验证（breath/hold/grow/trace/pulse/dream）
- ElevenLabs TTS（voice `63tJR9OsnD7dUy7TALIm`，stability 0.4，style 0.15，speed 1.08）
- `start.sh` 一键启动脚本

---

## Sprint 3 · 2026-06-16

### 记账双轨化

Chat.tsx 新增 `TokenUsage = { input, output, cache }` 类型，`recordTokens()` 函数按日期存入 `summertimes_tokens` localStorage，支持旧格式（number）自动迁移。API 响应解析三轨 token（`prompt_tokens` / `completion_tokens` / `cached_tokens`，含 fallback 字段名）。输入框下方实时显示当次会话消耗（↑input ↓output ⚡cache + 费用）。

TokenFlow.tsx 重写为 Console 风格：今日双轨费用块、累计四卡、近14天堆叠柱状图（绿=input，金=output）、逐日 console log。费率：input $3/M，output $15/M，cache $0.3/M。

### Memories 三标签

Memories.tsx 新增 `snippets` / `letters` 标签，读取 `summertimes_snippets` 和 `summertimes_letters` localStorage，支持展开查看批注/正文。三标签切换：记忆桶 / snippets / letters。

### 部署调研

`deploy-research.md`：Tailscale vs VPS vs Cloudflare Tunnel 对比，最终决策 VPS（Vultr Tokyo JP），理由是 24h 在线不依赖 MacBook。

---

## Sprint 4 · 2026-06-16

### VPS 购置

Vultr Tokyo JP，Ubuntu 24.04 LTS，IP `45.77.8.147`。

### 域名

`summertimes.app`（Porkbun 购入），DNS A 记录直接指向 VPS IP。

### 一键部署脚本

编写 `setup-vps.sh`（9步）：系统依赖 → Docker → Node.js 20 → 克隆 repo → `.env` + `bridge.py` → build 前端 → OmbreBrain Docker Compose → bridge.py systemd → Nginx + UFW。

手动补全步骤（脚本因旧代码 TS 错误中途退出）：Nginx 配置、OmbreBrain 启动、bridge systemd 注册、防火墙规则。

### 生产部署

- Nginx 反向代理：`/` → `/var/www/summertimes`，`/api/` → `localhost:8888`
- OmbreBrain Docker：`p0luz/ombre-brain:latest`，`127.0.0.1:8000`
- bridge.py systemd 服务，开机自启
- Certbot SSL：`summertimes.app` + `www.summertimes.app`
- Nginx Basic Auth 登录保护（htpasswd）

### OmbreBrain dashboard

`ombre.summertimes.app` 子域名 → Nginx proxy → `localhost:8000`，独立 certbot 证书。Mac buckets 数据迁移至 VPS（修正嵌套路径问题）。

### 一键部署

`deploy.sh`：`git add -A` → commit → push → SSH VPS → pull + build + copy，全程约15秒。

### 当前架构

```
summertimes.app          → Nginx → /var/www/summertimes (React静态)
summertimes.app/api/*    → Nginx → bridge.py :8888 → OmbreBrain :8000
ombre.summertimes.app    → Nginx → OmbreBrain :8000 (dashboard)
```

所有服务 VPS 自启，Mac 关机不影响线上。

---

## Sprint 5 · 2026-06-18

### git 作者信息
`git config --global user.name "Eve"` + `user.email "linanqiu332@gmail.com"`，不再报警。

### Claude Desktop → VPS OmbreBrain
编写 `connect-vps-ombre.sh`：在 VPS nginx ombre 配置中添加 `/mcp` location（无 Basic Auth），然后更新 Claude Desktop `claude_desktop_config.json` 将 OmbreBrain URL 改为 `https://ombre.summertimes.app/mcp`。Mac 关机后 Claude Desktop 记忆工具仍可用。

### App 内 OmbreBrain 入口
BottomNav 末尾新增 `⬡ ombre` 按钮，点击新标签打开 `https://ombre.summertimes.app`。

### 手机端体验优化
三处修复：`index.html` 补 `viewport-fit=cover`（iPhone home bar 不遮内容）；textarea `fontSize` 15→16px（防 iOS 自动放大）；BottomNav 底部 padding 改为 `calc(16px + env(safe-area-inset-bottom, 0px))`，图标/标签略缩（8项导航）。

### 聊天记录跨设备同步
bridge.py 新增 SQLite 持久化（`history.db`）及 `GET/POST /history` 接口；Chat.tsx 进入时拉取 VPS 历史并按 ID 合并本地，每次收到助手回复后自动推送全量消息到 VPS。deploy.sh 补 `systemctl restart bridge`，保证 bridge.py 更新后立即生效。

### 当前架构（更新）

```
summertimes.app           → Nginx → /var/www/summertimes (React静态)
summertimes.app/api/*     → Nginx → bridge.py :8888 → OmbreBrain :8000
summertimes.app/api/history  ← SQLite history.db 跨设备同步
ombre.summertimes.app     → Nginx → OmbreBrain :8000 (dashboard)
ombre.summertimes.app/mcp → Nginx → OmbreBrain :8000/mcp (Claude Desktop MCP)
```

---

## Sprint 6 计划（优先级排序）

1. **OmbreBrain grow / dream 工具接入** — bridge.py 目前只有 breath/hold/pulse/trace，grow（主动生长记忆）和 dream（离线整理）还没接进来。

2. **历史记录管理** — 消息越来越多，需要：清空按钮、只保留最近 N 条上下文（降 token 消耗）、可选的历史搜索联动 VPS 而非只搜本地缓存。

3. **Diary 页完善** — 入口已在 Home，但功能基本是空的。可以做成日记本：每天一篇，存 VPS。

4. **API keys 轮换** — apiyi、ElevenLabs、DeepSeek 都在代码/聊天里暴露过，有空 regenerate。
