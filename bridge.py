#!/usr/bin/env python3
import json, httpx, asyncio, os, re, sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── 聊天记录持久化 ───────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "history.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, data TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, data TEXT NOT NULL)")
    conn.commit()
    conn.close()

def load_history():
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT data FROM history WHERE id = 1").fetchone()
    conn.close()
    return json.loads(row[0]) if row else []

def save_history(data):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR REPLACE INTO history (id, data) VALUES (1, ?)", (json.dumps(data),))
    conn.commit()
    conn.close()

def get_all_store():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT key, data FROM store").fetchall()
    conn.close()
    return {row[0]: json.loads(row[1]) for row in rows}

def set_store(key, data):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR REPLACE INTO store (key, data) VALUES (?, ?)", (key, json.dumps(data)))
    conn.commit()
    conn.close()

init_db()
# ─────────────────────────────────────────────────────────

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

MCP_BASE = "http://localhost:8000"
# OB 2.3.x 把工具拆成两个端点：高频 5 个在 /mcp，低频 7 个在 /mcp-extra。
# 我们用到的里只有 pulse 在 extra；breath/hold/grow/dream/trace 仍在 /mcp。
# 先按这张表选端点，选错（或旧版根本没有 /mcp-extra）再自动回退到另一个——新旧版本都兼容。
EXTRA_TOOLS = {"pulse", "plan", "anchor", "release", "letter_write", "letter_read", "I"}
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

def _unknown_tool(res: dict) -> bool:
    # 端点握上手了，但回报「没这个工具」——说明该工具在另一个端点
    if not isinstance(res, dict):
        return False
    err = res.get("error")
    if isinstance(err, dict):
        msg = str(err.get("message", "")).lower()
        return "tool" in msg or "unknown" in msg or "method not found" in msg
    return False

async def _call_endpoint(client, url: str, name: str, args: dict):
    # Step 1: initialize
    r1 = await client.post(url, headers=HEADERS, json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                   "clientInfo": {"name": "summertimes", "version": "1.0"}}
    })
    session_id = r1.headers.get("mcp-session-id")
    if not session_id:
        return None  # 没握上手（多半是旧版没有这个路由）→ 让上层回退

    h2 = {**HEADERS, "mcp-session-id": session_id}

    # Step 2: initialized notification
    await client.post(url, headers=h2, json={
        "jsonrpc": "2.0", "method": "notifications/initialized"
    })

    # Step 3: call tool
    r3 = await client.post(url, headers=h2, json={
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {"name": name, "arguments": args}
    })
    return parse_sse(r3.text) or {"raw": r3.text[:500]}

async def call_tool(name: str, args: dict) -> dict:
    primary  = "/mcp-extra" if name in EXTRA_TOOLS else "/mcp"
    fallback = "/mcp" if primary == "/mcp-extra" else "/mcp-extra"
    async with httpx.AsyncClient(timeout=30) as client:
        res = await _call_endpoint(client, MCP_BASE + primary, name, args)
        # 主端点没握手 / 回报没这个工具 → 退到另一个端点再试一次
        if res is None or _unknown_tool(res):
            alt = await _call_endpoint(client, MCP_BASE + fallback, name, args)
            if alt is not None:
                return alt
        return res if res is not None else {"error": "no session"}

def web_search(query: str, n: int = 5) -> list:
    # DuckDuckGo 搜索。懒导入：库没装也不至于让整个 bridge 起不来。
    if not query:
        return []
    DDGS = None
    try:
        from ddgs import DDGS as _D
        DDGS = _D
    except Exception:
        try:
            from duckduckgo_search import DDGS as _D
            DDGS = _D
        except Exception:
            return [{"title": "", "url": "", "snippet": "搜索库未安装：在 VPS 上 pip install ddgs"}]
    try:
        out = []
        with DDGS() as d:
            for r in d.text(query, max_results=n):
                out.append({
                    "title": r.get("title", ""),
                    "url": r.get("href") or r.get("url", ""),
                    "snippet": r.get("body", ""),
                })
        return out
    except Exception as e:
        return [{"title": "", "url": "", "snippet": f"搜索失败: {e}"}]

def stt_text(audio: bytes, mime: str) -> str:
    # 语音转文字：ElevenLabs scribe，自动认语言（中英混说也行）
    if not ELEVEN_KEY or not audio:
        return ""
    ext = "mp4" if "mp4" in mime else ("webm" if "webm" in mime else "wav")
    try:
        r = httpx.post("https://api.elevenlabs.io/v1/speech-to-text",
                       timeout=60, headers={"xi-api-key": ELEVEN_KEY},
                       data={"model_id": "scribe_v1"},
                       files={"file": (f"audio.{ext}", audio, mime)})
        if r.status_code == 200:
            return (r.json().get("text") or "").strip()
    except Exception:
        pass
    return ""

def tts_audio(text: str) -> bytes:
    if not ELEVEN_KEY:
        return b""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE}"
    # 首选 eleven_v3：认识文本里的 [softly] [sighs] 等 audio tags，按情绪读；
    # v3 出错（账号不支持/参数不合）自动回退 v2，剥掉标签照常出声。
    attempts = [
        ("eleven_v3", text, {
            "stability": 0.5,            # v3 只认 0.0/0.5/1.0：Natural
            "similarity_boost": 0.8,
        }),
        ("eleven_multilingual_v2", re.sub(r"\[[a-zA-Z ]{2,20}\]", "", text), {
            "stability": 0.4,            # 低一点 → 年龄感降、声音更活
            "similarity_boost": 0.8,
            "style": 0.15,               # 一点点 style → 更有生气
            "speed": 1.08                # 稍快一点点
        }),
    ]
    for model_id, t, settings in attempts:
        try:
            r = httpx.post(url, timeout=90,
                headers={"xi-api-key": ELEVEN_KEY, "Content-Type": "application/json"},
                json={"text": t, "model_id": model_id,
                      "output_format": "mp3_44100_128",
                      "voice_settings": settings})
            if r.status_code == 200:
                return r.content
        except Exception:
            pass
    return b""

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/history":
            data = load_history()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/store":
            data = get_all_store()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))

        # /stt 收原始音频字节，不能当 JSON 解析，单独处理
        if self.path == "/stt":
            raw = self.rfile.read(length) if length else b""
            text = stt_text(raw, self.headers.get("Content-Type", "audio/webm"))
            payload = json.dumps({"text": text}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)
            return

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
        elif self.path == "/history":
            save_history(body)
            result = {"ok": True}
        elif self.path == "/store":
            set_store(body.get("key", ""), body.get("data"))
            result = {"ok": True}
        elif self.path == "/grow":
            result = asyncio.run(call_tool("grow", {
                "bucket_id": body.get("bucket_id", ""),
                "content": body.get("content", "")
            }))
        elif self.path == "/dream":
            result = asyncio.run(call_tool("dream", {}))
        elif self.path == "/plan":
            result = asyncio.run(call_tool("plan", {
                "content": body.get("content", ""),
                "status": body.get("status", "active"),
                "weight": body.get("weight", 0.5),
                "why_remembered": body.get("why_remembered", "")
            }))
        elif self.path == "/I":
            result = asyncio.run(call_tool("I", {
                "content": body.get("content", ""),
                "aspect": body.get("aspect", ""),
                "read": body.get("read", False),
                "limit": body.get("limit", 20)
            }))
        elif self.path == "/search":
            result = {"results": web_search(body.get("query", ""), int(body.get("n", 5)))}
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
