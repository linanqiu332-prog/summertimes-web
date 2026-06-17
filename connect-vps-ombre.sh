#!/bin/bash
# Sprint 5: Claude Desktop → VPS OmbreBrain
# Usage: bash ~/summertimes-web/connect-vps-ombre.sh

set -e

echo "▶ [1/2] 更新 VPS nginx（开放 /mcp 无需 Basic Auth）..."
ssh root@45.77.8.147 << 'SSHEOF'
python3 - << 'PYEOF'
with open("/etc/nginx/sites-available/ombre", "r") as f:
    content = f.read()

mcp_block = """
    location /mcp {
        proxy_pass http://localhost:8000/mcp;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

"""

if "location /mcp" not in content:
    content = content.replace("    location / {", mcp_block + "    location / {")
    with open("/etc/nginx/sites-available/ombre", "w") as f:
        f.write(content)
    print("  added /mcp block")
else:
    print("  /mcp block already exists")
PYEOF
nginx -t && systemctl reload nginx && echo "  nginx OK"
SSHEOF

echo ""
echo "▶ [2/2] 更新 Claude Desktop MCP 配置..."
python3 - << 'PYEOF'
import json, os

path = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")

with open(path, "r") as f:
    config = json.load(f)

servers = config.get("mcpServers", {})
updated = False

print("  current mcpServers:")
for k, v in servers.items():
    args = v.get("args", [])
    print(f"    {k}: {args}")
    for i, a in enumerate(args):
        if isinstance(a, str) and "localhost:8000" in a:
            args[i] = "https://ombre.summertimes.app/mcp"
            updated = True

if updated:
    with open(path, "w") as f:
        json.dump(config, f, indent=2)
    print("")
    print("  done -> https://ombre.summertimes.app/mcp")
    print("  restart Claude Desktop to apply")
else:
    print("")
    print("  WARNING: no localhost:8000 found in args above")
    print("  manually change OmbreBrain URL to: https://ombre.summertimes.app/mcp")
PYEOF

echo ""
echo "done! restart Claude Desktop - memory tools will use VPS from now on."
