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

## Sprint 6 · 2026-06-18～19

### 已完成

**非聊天数据跨设备同步**
新建 `src/sync.ts`，定义 `SYNC_KEYS`（tokens / snippets / letters / countdowns / diary / reminders），`syncFromVPS()` 冷启动时先拉 VPS 全量写入本地，再把本地全量推回 VPS；`syncToVPS(key)` 每次写操作后增量推。App.tsx 挂载时调用 `syncFromVPS()`，加 `synced` 渲染门控（同步完成前只渲染背景）。

bridge.py 新增 SQLite `store` 表，`GET /store` 返回全部键值，`POST /store` 写入单条。

各页面写操作后追加 `syncToVPS` 调用：Chat.tsx（tokens / snippets / letters）、Home.tsx（countdowns）、Diary.tsx、Reminders.tsx。

**上下文截断**
Chat.tsx 中发 API 请求前 `.slice(-30)` 只取最近 30 条消息，避免无限膨胀。（注：System prompt 本身较大，实际 input bytes 仍较高，见"未解决"）

**OmbreBrain grow / dream 接入**
bridge.py 新增 `POST /grow`（参数：bucket_id, content）和 `POST /dream`（无参），转发至 OmbreBrain MCP 工具。前端 UI 尚未接入。

**Diary / Reminders 完善**
两页 textarea `fontSize` 15→16px 防 iOS 自动放大；Diary 和 Reminders 的持久化函数均补 `syncToVPS`。

**PWA**
`public/manifest.json`（name / display:standalone / background+theme:#1a1f24 / icons）、`public/sw.js`（cache-name `summertimes-v2`，network-first，跳过 /api/）、`index.html` 补全 PWA meta（apple-mobile-web-app-capable / status-bar-style:black / theme-color）+ service worker 注册。

**deploy.sh 修复**
- 原 bug：`git diff --cached --quiet || git commit && git push`，若暂存区干净（但有未推送 commit）会跳过 push。
- 修复：改为先 `git add -A`，再条件 commit，最后无条件 `git push`。
- 新增 `systemctl restart bridge`，保证 bridge.py 更新后立即生效。

---

### 未解决 🔴

**PWA 顶部黑条（Dynamic Island 下方）**
iOS 独立模式下，状态栏区域出现一截 `#1a1f24` 深色背景，beach 图未延伸上去。已尝试三种方案均失败：

| 方案 | 问题 |
|---|---|
| `.app` 加 `padding-top: env(safe-area-inset-top)`，`.bg/.overlay` 加负 top | `overflow:hidden` 裁掉溢出部分，图片反而缺角 |
| `body` 直接设 beach 图 `background-attachment: fixed` | iOS Safari / PWA 不支持 `fixed` attachment，图片不渲染 |
| `status-bar-style: black` + 恢复 body 纯色 | 条仍在，左侧出现文字残影 |

根本原因尚不明确：可能是 iOS 把 safe-area-inset-top 区域单独合成，与 `overflow:hidden` 容器不在同一层。待尝试方向：用 `position:fixed; inset:0` 替代 `height:100dvh`，或重装 PWA（iOS 缓存 meta 标签于安装时）。

**跨设备同步仍未生效**
症状：手机 PWA 除 chat 外其余数据不同步。根本原因疑为 `VITE_BRIDGE_URL=http://localhost:8888` —— 该值在 `.gitignore` 的 `.env` 中，VPS build 时若用同一值，手机端请求会打到手机本地（不存在的服务）。VPS 上的 `.env` 内容待确认。

排查命令（需在 Mac 终端运行）：
```bash
ssh root@45.77.8.147 'cat /opt/summertimes-web/.env && echo "---" && curl -s http://localhost:8888/store'
```

**上下文截断效果有限**
`slice(-30)` 保留最近 30 条有效，但 system prompt（persona + 工具描述）本身体积大，实测两条消息 input 仍达 24322 字节。需单独精简 system prompt 或把 persona 移至首条 user message。

---

### 下一步

1. 确认 VPS `.env` 中 `VITE_BRIDGE_URL` 的实际值，修复同步
2. PWA 顶部黑条：尝试 `position:fixed` 方案 + 重装 PWA
3. 精简 system prompt，降低每次请求 token 基线
4. grow / dream 前端 UI
5. 历史记录管理：清空按钮 + 消息计数展示

---

## Sprint 7 · 2026-06-19

### 跨设备同步（结 Sprint6 🔴）

根因不是 VPS `.env` 填错，是代码压根没走 nginx：`sync.ts` / `Chat` / `Diary` / `Memories` / `Letters` 全部直接打 `VITE_BRIDGE_URL`（= `localhost:8888`），build 进静态文件后手机浏览器把请求打到自己本地。

新建 `src/bridge.ts`，运行时按 `window.location.hostname` 判断：`localhost`/`127.0.0.1` 直连 `:8888`，其它 host 一律走相对 `/api`（nginx `location /api/ { proxy_pass …:8888/; }` 带尾斜杠会 strip 前缀）。五处全切到 `import { BRIDGE } from './bridge'`。**从此不依赖 VPS `.env` 的值。**

### PWA 顶部黑条（结 Sprint6 🔴）

`.bg` / `.overlay` 从 `position:absolute` 改 `fixed; inset:0`（逃出祖先 `overflow:hidden`，铺满整屏含安全区）；`index.html` 状态栏 `black` → `black-translucent`；九页套 `.safe-screen`；`sw.js` 缓存 v2→v3。**装着的旧 PWA 需删除重装**（iOS 安装时焊死 meta）。

### grow / dream 前端 UI

Memories 记忆桶每张卡加 `＋`（补充内容 → `/grow`），顶栏加 `☾`（整合 → `/dream`），带轻量提示条。

### 聊天历史管理

Chat 搜索面板内加消息总数 + 「清空记录」（本机 + VPS `/history` 一起清）。

### UI 重设计（第一轮，未完）

- **主图**：`.bg` 换本地 `/bg.jpg`（wabi-sabi 暖调室内图，Eve 提供）；body / theme-color / manifest 三处 navy `#1a1f24` → 暖近黑 `#171311`，消除底部安全区蓝黑条。sw 缓存 v3→v4。
- **副屏蒙版**：新增 `.overlay-dark`，先平铺黑 75%，后改竖向渐变 vignette（顶/底 0.8 压字、中段 0.55 让图透气），八个子页用它，首页保持亮（`.overlay` 暖调 40%）。
- **统一图标**：新建 `components/Icon.tsx`，零依赖内联 SVG，1.4 细线圆角十枚（home/chat/memories/snippets/letters/diary/reminders/tokens/persona/ombre）。BottomNav 和首页导航替换原先杂乱 glyph（⌂◈✦✉◇◎◉⬡）。
- **布局收紧**：各页毛玻璃顶栏 padding 改 `calc(11px + env(safe-area-inset-top))` 延进灵动岛、填掉顶部死黑；`.safe-screen` 不再统一加 top padding，改由顶栏自撑，首页内容补 safe-top；BottomNav 底 padding `16px+safe` → `7px+safe`，首页导航去固定 22% 高度改自适应 + 补 safe-area-inset-bottom；Memories（示范页）标签/统计/分层间距各收一档。

### 验证

`tsc -b --noEmit` 全程 exit 0。`vite build` 在沙箱跑不了（node_modules 是 Mac arm64-darwin 原生二进制），VPS / 本机 build 正常。eslint 报的空 `catch`、`Date.now`、effect setState 均为既有问题，且不在 build 链上。图标渲染单独出图核对，十枚风格统一。

### 未解决 / 明日继续 🔴

- **`public/bg.jpg` 待确认**：主图换本地路径，需 Eve 把室内图存为 `~/summertimes-web/public/bg.jpg` 后部署才生效。
- **页内间距只做了 Memories**：顶栏 / 蒙版 / 导航的全局改动已覆盖所有页，但 Diary / Letters / Reminders / Snippets / Persona / TokenFlow / Chat 的**页内**间距尚未单独收紧，待 Eve 确认 Memories + 首页密度后统一推。
- **部署待跑**：`cd ~/summertimes-web && bash deploy.sh`（今日曾遇 `.git/HEAD.lock` 死锁，已知 `rm -f` 清掉即可）。

### 下一步

1. 存 `bg.jpg` + 部署，验收首页 / Memories 新密度
2. 密度 OK 后把页内间距收紧推到其余六页
3. 精简 system prompt，降 token 基线（Sprint6 遗留）
4. PWA 重装后复核顶/底安全区表现
