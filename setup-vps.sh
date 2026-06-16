#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  Summertimes VPS 一键部署脚本
#  服务器：45.77.8.147  Ubuntu 24.04
#  域名：summertimes.app
#  用法：在 VPS root 用户下运行 bash setup-vps.sh
# ══════════════════════════════════════════════════════════════
set -e

echo "▶ [1/9] 系统更新 + 基础依赖"
apt update -y && apt upgrade -y
apt install -y curl git nginx python3 python3-pip \
               certbot python3-certbot-nginx ufw

echo "▶ [2/9] Docker"
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

echo "▶ [3/9] Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "▶ [4/9] 克隆 summertimes-web"
cd /opt
git clone https://github.com/linanqiu332-prog/summertimes-web.git
cd /opt/summertimes-web

echo "▶ [5/9] 写 .env"
cat > /opt/summertimes-web/.env << 'ENVEOF'
VITE_API_KEY=sk-BSmZyKUQzfL2jRex182e9420E9324c90B4C8B4F4F4DcFa1d
VITE_API_URL=https://api.apiyi.com/v1/chat/completions
VITE_BRIDGE_URL=https://summertimes.app/api
VITE_ELEVEN_VOICE_ID=63tJR9OsnD7dUy7TALIm
ELEVEN_API_KEY=sk_21c058b9eb4f672a69545cc976cf43232a12f982a71f366a
ENVEOF

echo "▶ [5b/9] 写 bridge.py（不在 GitHub repo 里，手动放入）"
cat > /opt/summertimes-web/bridge.py << 'PYEOF'
#!/usr/bin/env python3
import json, httpx, asyncio, os
from http.server import HTTPServer, BaseHTTPRequestHandler

def load_env(path):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("'\"")
    except FileNotFoundError:
        pass
    return env

ENV = load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
if "ELEVEN_API_KEY" not in ENV:
    ENV = load_env(os.path.expanduser("~/summertimes-web/.env"))

ELEVEN_KEY = ENV.get("ELEVEN_API_KEY", "")
ELEVEN_VOICE = ENV.get("VITE_ELEVEN_VOICE_ID", "63tJR9OsnD7dUy7TALIm")

MCP_URL = "http://localhost:8000/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def parse_sse(text):
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                return json.loads(line[6:])
            except:
                pass
    return None

async def call_tool(name: str, args: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r1 = await client.post(MCP_URL, headers=HEADERS, json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                       "clientInfo": {"name": "summertimes", "version": "1.0"}}
        })
        session_id = r1.headers.get("mcp-session-id")
        if not session_id:
            d = parse_sse(r1.text)
            if d:
                session_id = r1.headers.get("mcp-session-id")
        if not session_id:
            return {"error": "no session"}
        h2 = {**HEADERS, "mcp-session-id": session_id}
        await client.post(MCP_URL, headers=h2, json={
            "jsonrpc": "2.0", "method": "notifications/initialized"
        })
        r3 = await client.post(MCP_URL, headers=h2, json={
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {"name": name, "arguments": args}
        })
        result = parse_sse(r3.text)
        return result or {"raw": r3.text[:500]}

def tts_audio(text: str) -> bytes:
    if not ELEVEN_KEY:
        return b""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE}"
    r = httpx.post(url, timeout=60,
        headers={"xi-api-key": ELEVEN_KEY, "Content-Type": "application/json"},
        json={"text": text, "model_id": "eleven_multilingual_v2",
              "output_format": "mp3_44100_128",
              "voice_settings": {"stability": 0.4, "similarity_boost": 0.8,
                                 "style": 0.15, "speed": 1.08}})
    return r.content if r.status_code == 200 else b""

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        if self.path == "/tts":
            audio = tts_audio(body.get("text", ""))
            if audio:
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(audio)
            else:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "tts failed"}).encode())
            return
        if self.path == "/breath":
            result = asyncio.run(call_tool("breath", {"query": body.get("query", "")}))
        elif self.path == "/hold":
            result = asyncio.run(call_tool("hold", {
                "content": body.get("content", ""),
                "tags": body.get("tags", ""),
                "importance": body.get("importance", 5),
                "feel": body.get("feel", False)
            }))
        elif self.path == "/pulse":
            result = asyncio.run(call_tool("pulse", {"include_archive": body.get("include_archive", False)}))
        elif self.path == "/trace":
            args = {"bucket_id": body.get("bucket_id", "")}
            for k in ("pinned", "resolved", "digested", "delete",
                      "importance", "content", "name", "tags", "domain"):
                if k in body:
                    args[k] = body[k]
            result = asyncio.run(call_tool("trace", args))
        else:
            result = {"error": "unknown path"}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

if __name__ == "__main__":
    server = HTTPServer(("localhost", 8888), Handler)
    print("bridge → http://localhost:8888")
    server.serve_forever()
PYEOF

echo "▶ [6/9] Build 前端"
cd /opt/summertimes-web
npm install
npm run build
mkdir -p /var/www/summertimes
cp -r dist/. /var/www/summertimes/

echo "▶ [7/9] OmbreBrain Docker"
mkdir -p /opt/ombre-brain/buckets
cat > /opt/ombre-brain/.env << 'OMBREEOF'
OMBRE_API_KEY=sk-0ed6c8f64d69495c85932a4a54a5c543
OMBREEOF

cat > /opt/ombre-brain/docker-compose.yml << 'DCEOF'
services:
  ombre-brain:
    image: p0luz/ombre-brain:latest
    container_name: ombre-brain
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      - OMBRE_API_KEY=${OMBRE_API_KEY}
      - OMBRE_TRANSPORT=streamable-http
      - OMBRE_BUCKETS_DIR=/data
    volumes:
      - ./buckets:/data
DCEOF

cd /opt/ombre-brain
docker compose up -d

echo "▶ [8/9] bridge.py systemd service"
pip3 install httpx --break-system-packages

cat > /etc/systemd/system/bridge.service << 'SVCEOF'
[Unit]
Description=Summertimes Bridge
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/summertimes-web
ExecStart=/usr/bin/python3 /opt/summertimes-web/bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable bridge
systemctl start bridge

echo "▶ [9/9] Nginx + Firewall"
cat > /etc/nginx/sites-available/summertimes << 'NGINXEOF'
server {
    listen 80;
    server_name summertimes.app www.summertimes.app;

    root /var/www/summertimes;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bridge 代理：/api/breath → localhost:8888/breath
    location /api/ {
        proxy_pass http://localhost:8888/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/summertimes /etc/nginx/sites-enabled/summertimes
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "✅ 部署完成！"
echo ""
echo "接下来还要做三件事："
echo ""
echo "① 迁移记忆数据（在你 Mac 终端跑）："
echo "   scp -r ~/ombre-brain/buckets/ root@45.77.8.147:/opt/ombre-brain/buckets/"
echo "   迁完后重启 OmbreBrain："
echo "   ssh root@45.77.8.147 'cd /opt/ombre-brain && docker compose restart'"
echo ""
echo "② DNS：在 Cloudflare 加 A 记录"
echo "   summertimes.app  →  45.77.8.147"
echo "   www              →  45.77.8.147"
echo ""
echo "③ SSL（DNS 生效后在 VPS 跑）："
echo "   certbot --nginx -d summertimes.app -d www.summertimes.app"
