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
