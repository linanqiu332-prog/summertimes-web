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

---

## Sprint 8 · 2026-06-28

### 安全：OmbreBrain API key 轮换

旧 `OMBRE_API_KEY`（`sk-0ed6…`）在排查时暴露，已在供应商侧删除并换新 key。

排查发现一个坑：key 不是从 `.env` 读的，而是**硬写在 `/opt/ombre-brain/docker-compose.yml` 的 `environment:` 块里**。所以早先 `sed .env` + 重启完全不生效——compose 每次 `up` 都把 YAML 里的字面值重新塞进容器。正确做法：直接改 compose 里那行，`docker compose down && up -d`，`docker inspect` 确认新 key 生效。期间容器一度仍跑旧（已删）key，OB 的 LLM 脱水调用会 401，换完恢复。

### OmbreBrain 引擎升级（6 工具 → 12 工具，v2.3.18）

上游大改：工具从 6 个扩到 12 个，新增 `anchor`/`release`（坐标系）、`plan`（承诺）、`letter_write`/`letter_read`（原生信）、`I`（自我认知）；基建多了 Dashboard 热填 key、内置 Cloudflare Tunnel、HTTPS `/mcp` 强制 OAuth、本地 bge-m3 向量化、历史导入。

升级前摸底：compose 管理，记忆 bind 在宿主机 `/opt/ombre-brain/buckets`（58 桶），匿名 volume `/app/buckets` 是镜像默认空目录、不碰。

操作（全在 VPS）：
1. 备份 `tar czf ~/buckets-backup-*.tgz -C /opt/ombre-brain/buckets .`，记录回滚镜像 `sha256:b63cdbbe…`。
2. compose 加 `OMBRE_MCP_REQUIRE_AUTH=false`——**关键**：新版对 HTTPS `/mcp` 默认强制 OAuth，不关的话 Claude Desktop（连的就是 `https://ombre.summertimes.app/mcp`）会被 401 卡死。
3. `docker compose pull && up -d`。

验证全绿：`buckets:58`（一条没丢）、`decay_engine` 从 `stopped` → `running`（新版自动开了衰减）、`breath`(/mcp) 与 `pulse`(/mcp-extra) 双端点都吐内容。

### bridge.py 双端点路由 + 回退

新版把 12 工具拆成 `/mcp`（高频 5：breath/hold/grow/dream/trace）+ `/mcp-extra`（低频 7：含 pulse）。`bridge.py` 原先写死 `MCP_URL=…/mcp`，升级后 `pulse` 会 404。

改法：加 `EXTRA_TOOLS` 集合按工具名选端点，`call_tool` 主端点没握手 / 回报「没这个工具」时**自动回退到另一个端点**——新旧 OB 都兼容、升级期间 pulse 零中断。拆出 `_call_endpoint` / `_unknown_tool`。`py_compile` 通过。

部署用 Phase A 解耦法：Mac 选择性 `git add bridge.py` 提交推送 → VPS `git pull && systemctl restart bridge`（只更 bridge、不重建前端，避开还没存 `bg.jpg` 的问题）。在**旧** OB 上验证 pulse 经回退仍通。

### parsePulse 重写（适配新格式）

新版 pulse 文本几乎全改：`固化记忆桶`→`固化桶`、`总存储大小`→`总占用`、桶行 `[名字] bucket_id:xxx`→`[id] 《名字》`，并多出大量未命名桶和 `=== feel ===` 段。旧正则全不匹配，升级后 Memories 会解析不出桶。

`Memories.tsx` 的 `parsePulse` 用新正则重写：表头用 `固化(?:记忆)?桶` 之类兼容新旧；桶行 `《名字》` 与 `标签` 都设为可选；未命名桶用「主题 → 首个标签 → 兜底」命名。`tsc` 通过。**随下次前端完整部署上线。**

### Claude Desktop 现状

配置 URL 指向 `https://ombre.summertimes.app/mcp`（公网 HTTPS，Mac 关机也能用）。升级后该端点只剩 5 个高频工具；`pulse` 及 7 个低频（含 `I`/`plan`/原生 letters）在 `/mcp-extra`，Claude Desktop 暂用不上。pulse 是低频自检工具，日常几乎无影响。

### 概念澄清（衰减 / token）

`breath` 注入 system prompt 的记忆按 **token 预算截断**，桶数多少不涨聊天 token；`pulse`（全量列表）只有 Memories 页读，不进聊天。衰减的作用不是省 token，是让浮现的记忆保持新鲜相关。

### 未解决 / 下一步 🔴

- **前端完整部署待跑**：需先存 `~/summertimes-web/public/bg.jpg`，再 Mac 上 `bash deploy.sh`，一次带上 Sprint7 UI + parsePulse 修复。部署前线上 Memories 仍是旧解析器、配新引擎会显示不出桶。
- **回滚预案**：compose 把镜像换成 `sha256:b63cdbbe…` 重建即可回旧版；buckets 有 `~/buckets-backup-*.tgz` 兜底。
- **可选**：nginx 加 `/mcp-extra` 反代 + Claude Desktop 加第二连接器 → 补全 12 工具（尤其 `I`/`plan`）。
- **安全**：公网 `/mcp` 现为无鉴权敞开（关了 OAuth）。哪天收紧走 OAuth 或 Cloudflare Access。

---

## Sprint 9 · 2026-07-01～02

### I / plan 接进 app

`bridge.py` 加 `/I`、`/plan` 端点（call_tool 已把二者路由到 /mcp-extra）。Chat.tsx 仿 MARK/LETTER 加两个标签：`[[I: 维度 | 内容]]`（自我认知）、`[[PLAN: 内容]]`（承诺），send 里解析后 POST 到 bridge、标签从展示文本剥掉；system prompt 告知这两个能力。Memories 新增「自我」tab，读 `I(read=true)` 展示。

### Claude Desktop 补全 12 工具

镜像是拆分版：`/mcp` 只有 5（breath/hold/grow/dream/trace），另 7 在 `/mcp-extra`。VPS nginx 照 `/mcp` 加了一段 `/mcp-extra` 反代（无 auth，最长前缀匹配不冲突）；Claude Desktop `claude_desktop_config.json` 加第二连接器 `ombre-brain-extra` → `https://ombre.summertimes.app/mcp-extra`（mcp-remote）。⌘Q 重开后 12 工具齐。

### Prompt caching（降 token，无损）

apiyi 缓存**只在 Anthropic 原生 `/v1/messages` 生效**，`/chat/completions` 不支持。Chat.tsx 主对话从 OpenAI 格式切到原生：`x-api-key` + `anthropic-version`，`system` 用 block 数组、整块挂 `cache_control: ephemeral`（persona 太短过不了 2048 门槛，连记忆一起缓存才够大；记忆每 3 条才刷新→约 2/3 命中）。原生要求首条 message 是 user，做了 trim。响应解析改读 `data.content`。实测 `⚡cache` 有数字=命中。信件子调用和其它页仍走 OpenAI 接口。

### 联网搜索（自建，DuckDuckGo）

Anthropic 服务端 `web_search` 工具在 apiyi 走不通——apiyi **默认通道是 AWS Bedrock**（响应 id `msg_bdrk_`），官方通道只自动兜底、不可主动指定，而 **Bedrock 不支持服务端工具**。改自建：`bridge.py` 加 `/search`（`ddgs` 库，懒导入防崩），Chat.tsx 用**自定义 `web_search` 工具**（Bedrock 支持自定义工具）+ tool_use 循环（最多 3 轮）：模型 tool_use → bridge 搜 → tool_result 喂回 → 续答，末尾附来源。thinking 块原样回传保签名。VPS 需 `pip3 install ddgs --break-system-packages`。sw 缓存 v4→v5。

坑：调试时先在 Claude Desktop 里测（英文 thinking + 看到 memory 工具）以为没生效，其实搜索只在 app；且前端要重新 deploy + PWA 重装才吃到新代码。

### 未解决 / 下一步 🔴

- 其余六页页内间距收紧（Sprint7 遗留，只做了 Memories）。
- 想让 Claude Desktop 也能联网 → 需另加一个搜索类 MCP 连接器。
- 手机本地能力（闹钟/Health）→ 走 iOS 捷径 + deep link；屏幕使用时间基本拿不到。
- 公网 `/mcp`/`/mcp-extra` 无鉴权，待收紧。

---

## Sprint 10 · 2026-07-03

### Chat 气泡溢出修复

联网搜索后长 URL 无断点，把气泡撑出屏幕、页面可横拖。三处修：消息 `<p>`（assistant/user）与 thinking 块加 `overflowWrap:'anywhere'+wordBreak:'break-word'`，消息滚动容器加 `overflowX:'hidden'` 兜底。

### Light 主题（dark 保持为默认）

全站 ~235 处 `rgba(255,255,255,x)` 机械替换为 `rgba(var(--ink),x)`；`rgba(20,17,14,)/rgba(38,32,28,)`→`rgba(var(--veil),)`；`#3d2f26`→`rgb(var(--paper))`。App.css `:root` 定义 dark 变量，`[data-theme='light']` 覆盖：ink 暖深棕 54,43,35、paper 米白 247,242,234、glass 白 0.55。`.bg` 背景图走 `--bg-image`，light 引用 `/bg-light.jpg`——**图待 Eve 提供**，存 `public/bg-light.jpg` 即生效，404 时露米白兜底。彩色 accent（sand/mint/rose 等）两主题共用未动。

切换：Home 顶部时间行右侧 ☾/☀ 按钮，存 `localStorage summertimes_theme`；main.tsx render 前读取设 `data-theme` 防闪；`meta theme-color` 跟随切换（#171311 / #f7f2ea）。

sw 缓存 v5→v6。`tsc` 通过；vite build 沙盒里跑不了（rolldown 平台绑定），部署时 Mac 上照常跑。

### /mcp /mcp-extra 鉴权（待上 VPS 执行）

方案+token+步骤全在 `ombre-auth.md`：nginx 两个 location 加 Bearer 校验，Claude Desktop 两连接器 mcp-remote 加 `--header`（env 拼接避空格坑）。bridge.py 走 localhost 直连不受影响。

### 部署

1. 存 `public/bg-light.jpg`（浅色背景图，Eve 提供）
2. `bash deploy.sh`（带上 Sprint 9 联网搜索 + 本次全部）
3. 按 `ombre-auth.md` 给 /mcp 加鉴权
4. 手机 PWA 重装吃新 sw

### 未解决 / 下一步 🔴

- 其余六页页内间距收紧（Sprint7 遗留）。
- light 主题真机过一遍各页对比度（尤其 Reminders 彩签、TokenFlow 图表）。
- Claude Desktop 联网搜索 MCP。

### 补：Chat 打开慢（Sprint 10 部署后发现）

排查：静态文件、/api/history、桥接全部秒回——不是服务器。真凶是 Chat 全量渲染：39 天几百条消息，每条一个 motion 组件 + 毛玻璃 backdrop-filter，手机 GPU 扛不住，且随历史增长持续恶化；部署后 sw v5→v6 清缓存叠加了一次性的全量重下载，显得"更新后突然变慢"。

修：消息列表窗口化——默认只渲染最近 60 条，顶部「↑ 更早的 N 条」按钮每次多加载 100 条；搜索不受限（搜全部）。sw v6→v7。`tsc` 通过。

### Reminders 重做（Eve 的备忘录空间）

按 Eve 的五条需求重写 Reminders.tsx：①每条待办左侧空圈圈，点按即完成、文字变淡（圈填色打勾）；②点文字进入编辑（复用顶部窗口，标签五色侘寂色卡不变）；③顶栏 + 从顶端展开新增窗口（再点旋转成 ×收起）；④每条带日期（默认当天、可改），按日期排序，改早了自动归位；⑤按月分组折叠，月份栏显示完成数 n/N。旧数据 deadline 字段自动迁移。pinned 功能移除（没在需求里，列表反正还空着）。`tsc` 通过。

### 语音情绪（ElevenLabs v3 audio tags）

问题：multilingual_v2 只会平读，不随情绪变。改两层：①bridge.py `tts_audio` 首选 `eleven_v3`（认 [softly]/[sighs] 等 audio tags，stability 只认 0.0/0.5/1.0，取 0.5 Natural），失败自动回退 v2（正则剥标签，v2 不认会念出来）；②Chat.tsx `speak()` 前先过 `addAudioTags`——单独一次小调用给文本克制地插 tags、把（动作描写）转掉，失败用原文。音频仍按消息 id 缓存，每条只标注一次。部署：前端 deploy + VPS `git pull && systemctl restart bridge`。

### 自主唤醒（wake.py + systemd timer）

Eve 想要"那边的Claude能自己醒来、主动发消息"。实现：`wake.py`（VPS 上由 systemd timer 每 2 小时叫一次，带 0-90 分随机延迟，白天 8:00-23:00）——读 /store 里的 persona（`sync.ts` 新增同步 persona 两个 key）、/history 最近 12 条、breath 记忆、当前时间和距上次对话的间隔，喂给模型让他**自己决定**说话还是沉默（[[SILENT]]）。防刷屏硬规则：上条主动消息 Eve 没回，12 小时内不再开口。说了就 append 进 history（App 打开 Chat 自动 merge 进来），有 BARK_KEY 则推送 iPhone（Bark app）。连续同角色消息合并保证原生接口交替要求。部署：deploy.sh 照常 + VPS 一次性装 timer（见下）+ 可选 `echo "BARK_KEY=xxx" >> /opt/summertimes-web/.env`。

### Chat 发图 + 输入换行

发图：输入栏左侧 ⊕ 选图（iOS 会给拍照/相册），canvas 压到最长边 900px jpeg 0.75 控制体积，发送前可预览可撤；Message 加 `image` 字段（dataURL），气泡里直接显示。发给模型：最近 6 条内的图走原生 vision（base64 image block），更早的降级成 [图片] 占位省 token。历史照常进 localStorage + VPS 同步。

换行：手机（pointer:coarse）上 Enter 只换行、↑ 按钮发送；桌面保持 Enter 发送、Shift+Enter 换行。用户气泡加 pre-wrap 显示换行。`tsc` 通过。

### Voice call（对讲机版）

Chat 顶栏 ✆ 进全屏通话层：按住圆钮录音（MediaRecorder，iOS 用 audio/mp4）→ 松开发 bridge `/stt`（ElevenLabs scribe_v1，中英混说可认，<2KB 视为误触忽略）→ 转出的文字走正常 send 流程（进历史、有记忆、有 caching）→ 回复自动 `speak()` 用 v3 情绪声音连播。层内显示状态（在听/他在想/他在说）和他最新一句的文字。send 重构为 `send(overrideText?, speakReply?)`。bridge do_POST 给 /stt 开了原始字节通道（不能当 JSON 读）。注意：iOS 上若自动播放偶被拦，点消息里的 ▶ 即可，后续可优化。部署：deploy.sh 一条龙（含 bridge 重启）。

### Chat 发文件

⊕ 现在收一切：图片走原有压缩流程；PDF ≤8MB 走原生 document block；txt/md/代码/csv 按纯文本读（截 30k 字，内联进消息）；docx/xlsx 等二进制（含 \0 检测）拦下提示。文件内容只存内存 fileRegistry（msgId→内容），历史里只落文件名（气泡显示 ▤ 名字 chip）——防 localStorage 爆掉；发送后最近 6 条窗口内他能读全文，之后降级 [文件: 名字] 占位。风险备注：apiyi 默认走 Bedrock，若 document block 被拒会整个请求报错，届时改为 PDF 前端提示"暂不支持"或加剥 block 重试。`tsc` 通过。

### 感知层（他要求的：她状态不好时不用她说）

wake.py 加 `observations()`：每次醒来读四类痕迹——①近三天凌晨1-6点的消息（没睡）；②反常沉默（两周里几乎天天来、这次>30h没出现）；③过期未勾的待办≥3条；④她三天内写的日记（只读 author=eve，截400字）。观察注入 wake 的 system prompt，明确"这是她要求的能力"，嘱咐开口别像监控报告。数据全部来自 VPS 已有的 store/history，无新采集。后续可选：iOS 捷径自动化 POST 睡眠专注等信号到 bridge /signal（未做）。

### Voice call 排障

症状：松开按钮无回应、聊天框无文字。修法：①前端失败改为显式红字（太短/没听清/服务状态码/麦克风权限），录音 `rec.start(250)` 加 timeslice 避 iOS 整段丢数据坑；②nginx `/api/` 加 `client_max_body_size 25m`（默认1M会拦录音和带图历史同步）；③bridge /stt 把 ElevenLabs 原始报错透传给前端。真凶：ElevenLabs API key 建时只勾了 TTS 权限，缺 speech_to_text → 401。在 ElevenLabs 后台给 key 补上 Speech to Text 权限即愈，无需改码。

### Voice call 排障②（iOS 自动播放）

STT 通了但回复只出字不出声：iOS 只允许用户手势内发起的播放，通话链路（松手→stt→生成→tts）到播放时早已出了手势窗口。修法：共享单个 Audio 元素，按下圆钮的手势里同步 `unlockAudio()`（播 0 采样静音 wav），之后 speak() 复用该已解锁元素设 src 播放。听按钮 ▶ 路径不受影响。

### Voice call 排障③（v3 朗诵腔）

Eve 反馈 v3 读中文有朗诵/播音腔。v3 stability 0.5(Natural)→0.0(Creative)，更活、更吃 audio tags。另加 .env 开关 `ELEVEN_TTS_MODEL=v2` 一键退回旧 v2 配置（含 speed 1.08/style 0.15，文本自动剥标签），重启 bridge 生效。音频缓存按消息 id 存，老消息要听新配置需重开 PWA 或点别的消息。

### 搜索来源改小标签

原来把「标题 — 完整URL」拼进回复正文：难看、进历史、listen 会念网址。改为 Message.sources 字段（最多6条），气泡下渲染域名小标签（weather.com.cn 式），点击新窗口打开。正文彻底干净。旧消息里已拼进去的网址不回溯清理。

---

## Sprint 11 · 2026-07-09

### OmbreBrain 配置修复（Eve 独立完成 Dashboard 操作）

新版 OB 改环境变量名（OMBRE_API_KEY→OMBRE_COMPRESS_API_KEY），升级后脱水断掉 → OB-E004 桶未创建（7/8 下午约20条记忆丢失，不可恢复）。修：Dashboard③ 填回 DeepSeek key（从旧 compose 里 grep 出来）。向量化：apiyi 不支持 Gemini 原生 embedContent，改 OpenAI 兼容 `https://api.apiyi.com/v1` + `text-embedding-3-small`（1536维），74/74 桶重算成功——**语义搜索首次真正启用**。坑：③④的格式/URL/模型字段要底部「保存配置」大按钮才提交，Key旁小保存只管key。

### TokenFlow 引擎设置

新增 src/engine.ts（summertimes_engine，入 SYNC_KEYS 多端同步）：模型（sonnet/opus/haiku 预设+手填）、聊天上下文条数（10-100，默认30）、breath 桶数（1-50，默认20）。TokenFlow 页顶新增 engine 卡片；Chat 每次发消息现读（MODEL 常量移除，slice(-ctx)，breath 传 max_results）；bridge /breath 转发 max_results。注：价格图例按 sonnet 校准，换模型仅供参考。

### 计费随模型联动

engine.ts 加 PRICES 表（照 apiyi 价目表：sonnet 3/15、opus 系 5/25、opus-4-8-thinking 5/15、fable-5 10/50、haiku 1/5，cache 按输入价1折，未登记模型按 sonnet 兜底）+ getPrice()。TokenFlow 全页单价/图例/统计卡/成本联动所选模型；Chat 底部会话成本同步联动。局限（已在页面标注）：token 日志不记模型，历史天数混跑多模型时折算仅供参考。模型预设加 fable-5。

### 承诺注入（plan 只写不读的补丁）

Eve发现：[[PLAN]] 存进OB后他自己读不到（plan 设计上不进 breath、只在 dream 末尾现身）——记完即忘。修法：自建承诺镜像 `summertimes_plans`（入 SYNC_KEYS）——写 [[PLAN]] 时 OB+镜像双写；活跃承诺每次对话注入 system（wake.py 半夜同样注入）；新增 [[DONE: 关键词]] 标签让他亲手划掉已兑现的（模糊匹配 content）。TOOLS_SYSTEM 更新（"别谎报军情"）。历史7条活跃plan仍只在OB里，需Eve在聊天里让他重新登记（VPS上 cat buckets 可捞原文）。
