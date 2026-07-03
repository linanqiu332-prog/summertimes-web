# 公网 /mcp、/mcp-extra 加鉴权（Sprint 10）

现状：`https://ombre.summertimes.app/mcp` 和 `/mcp-extra` 无鉴权敞开（Sprint 8 关了 OAuth 后的遗留）。
方案：nginx 层校验 `Authorization: Bearer <token>`，不动 OB 容器。`bridge.py` 走 `localhost:8000` 直连，不经 nginx，**零影响**。

本次 token（已随机生成，泄露就再 `openssl rand -hex 24` 换一个）：

```
4e2b3646694e9f8109777cdb5840a6e1db7d1b2bd5f9d968
```

## ① VPS：nginx 加校验

`ssh root@45.77.8.147`，编辑 ombre 的 server 块（`/etc/nginx/sites-available/` 下 `server_name ombre.summertimes.app` 那个文件），在 **`location /mcp`** 和 **`location /mcp-extra`** 两个块的 `proxy_pass` 之前各加：

```nginx
    if ($http_authorization != "Bearer 4e2b3646694e9f8109777cdb5840a6e1db7d1b2bd5f9d968") {
        return 401;
    }
```

然后：

```bash
nginx -t && systemctl reload nginx
```

## ② Mac：Claude Desktop 两个连接器加 header

`claude_desktop_config.json` 里 `ombre-brain` 和 `ombre-brain-extra` 的 args 各加两项，并加 env（用 env 变量拼，避开 mcp-remote 对含空格参数的坑）：

```json
{
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://ombre.summertimes.app/mcp",
    "--header", "Authorization:${AUTH_HEADER}"
  ],
  "env": {
    "AUTH_HEADER": "Bearer 4e2b3646694e9f8109777cdb5840a6e1db7d1b2bd5f9d968"
  }
}
```

（`ombre-brain-extra` 同样改，URL 换成 `/mcp-extra`。）⌘Q 重启 Claude Desktop。

## ③ 验证

```bash
# 无 token → 401
curl -si https://ombre.summertimes.app/mcp -X POST | head -1
# 带 token → 非 401（400/406 都算通，说明进到了 OB）
curl -si https://ombre.summertimes.app/mcp -X POST \
  -H "Authorization: Bearer 4e2b3646694e9f8109777cdb5840a6e1db7d1b2bd5f9d968" | head -1
```

Claude Desktop 里确认 12 个工具还在、`breath` 能出内容。

## 回滚

删掉两段 `if` → `nginx -t && systemctl reload nginx`，Desktop 配置里的 header 留着也无害。

---

# Cloudflare Access：给 summertimes.app 整站加登录（Sprint 10 追加）

效果：打开网站先输邮箱收验证码，白名单只有 linanqiu332@gmail.com。挡所有人，包括翻源码的。App 内部 `/api` 走同域 cookie，登录一次后无感。

**⚠️ 范围只包 `summertimes.app` + `www`，绝对不要包 `ombre.summertimes.app`**——Claude Desktop 的 mcp-remote 过不了 Access 的邮箱验证，包进去 12 个工具全断。ombre 那边已有 Bearer token，够了。

## 步骤（Cloudflare 后台，约 5 分钟）

1. dash.cloudflare.com → 选 summertimes.app 域 → **DNS**：确认 `summertimes.app` 和 `www` 两条 A 记录是 **Proxied（橙色云）**。灰色云的话点开切成橙色（Access 只对走 CF 代理的流量生效）。`ombre` 保持现状不动。
2. 左侧 **Zero Trust**（首次进会让选团队名，随便起，选 **Free** 计划）。
3. **Access → Applications → Add an application → Self-hosted**。
   - Application name: `summertimes`
   - Session Duration: **1 month**（多久重新验证一次，嫌烦可选更长）
   - Public hostname 加两条：`summertimes.app`（路径留空）和 `www.summertimes.app`
4. 建 Policy：
   - Name: `only-eve`，Action: **Allow**
   - Include → Selector 选 **Emails** → 填 `linanqiu332@gmail.com`
5. 登录方式默认 **One-time PIN**（邮箱验证码）就行，一路 Next 保存。

## 验证

- 无痕窗口开 summertimes.app → 应跳 Cloudflare 登录页
- 输 linanqiu332@gmail.com → 收 PIN → 进站，Chat/Memories 数据正常（说明 /api cookie 通了）
- `curl -si https://summertimes.app/api/history | head -1` → 应该是 302（被踢去登录页），不再直接吐历史
- Claude Desktop ⌘Q 重开 → 12 工具还在（确认 ombre 没被误伤）

## 注意

- 手机 PWA 到期重新验证时，会在 app 里弹 CF 登录页，输一次验证码即可。
- Access 挡住后，nginx 那层要不要再给 `/api/` 加 token 都无所谓了，属于双保险。
