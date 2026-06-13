#!/usr/bin/env python3
import json, httpx, asyncio, os
from http.server import HTTPServer, BaseHTTPRequestHandler

# 从 summertimes-web/.env 读 key（不带 VITE_ 的后端专用）
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
# 如果 bridge.py 不和 .env 同目录，再试 summertimes-web
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
        # Step 1: initialize
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

        # Step 2: initialized notification
        await client.post(MCP_URL, headers=h2, json={
            "jsonrpc": "2.0", "method": "notifications/initialized"
        })

        # Step 3: call tool
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
              "voice_settings": {
                  "stability": 0.4,        # 低一点 → 年龄感降、声音更活
                  "similarity_boost": 0.8,
                  "style": 0.15,           # 一点点 style → 更有生气
                  "speed": 1.08            # 稍快一点点
              }})
    if r.status_code == 200:
        return r.content
    return b""

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

        # /tts 返回音频二进制，单独处理
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
                self.wfile.write(json.dumps({"error": "tts failed - check ELEVEN_API_KEY"}).encode())
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
            result = asyncio.run(call_tool("pulse", {
                "include_archive": body.get("include_archive", False)
            }))
        elif self.path == "/trace":
            args = {"bucket_id": body.get("bucket_id", "")}
            # 只传前端给了的字段，没给的不传（trace 的约定：不传=不改）
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
    print("桥接服务跑起来了 → http://localhost:8888")
    server.serve_forever()
