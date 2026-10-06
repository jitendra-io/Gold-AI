import asyncio
import os
import re
import json
import uuid
import base64
import shutil
import subprocess
import webbrowser
import urllib.parse
import sqlite3
from datetime import datetime

import pygame
import psutil
import tempfile
import mss
from PIL import Image
import speech_recognition as sr
import edge_tts
from google import genai as google_genai
from groq import Groq
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Locate base directory whether running as source or PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

appdata = os.environ.get('APPDATA')
appdata_dir = os.path.join(appdata, "GOLD AI") if appdata else None
if appdata_dir:
    os.makedirs(appdata_dir, exist_ok=True)
    # Migrate .env from prior Wang AI or legacy directory if present
    for prior in ["Wang AI", "waaner-ai"]:
        prior_env = os.path.join(appdata, prior, ".env")
        dest_env = os.path.join(appdata_dir, ".env")
        if os.path.exists(prior_env) and not os.path.exists(dest_env):
            try:
                shutil.copy(prior_env, dest_env)
            except Exception:
                pass

env_candidates = [
    os.path.join(appdata_dir, ".env") if appdata_dir else "",
    os.path.join(BASE_DIR, ".env"),
    os.path.join(os.path.dirname(BASE_DIR), ".env"),
    os.path.join(os.getcwd(), ".env")
]
loaded_env = False
for ep in env_candidates:
    if ep and os.path.exists(ep):
        load_dotenv(ep)
        loaded_env = True
        # If loaded from bundle, also ensure copy in appdata for user persistence
        if appdata_dir and ep != os.path.join(appdata_dir, ".env"):
            try:
                dest = os.path.join(appdata_dir, ".env")
                if not os.path.exists(dest):
                    shutil.copy(ep, dest)
            except Exception:
                pass
        break
if not loaded_env:
    load_dotenv()

# ── Init ────────────────────────────────────────────────────
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

VOICE = "en-IN-PrabhatNeural"
VOICE_RATE = "+15%"
pygame.mixer.init()
stop_tts_event = asyncio.Event()

# Prime psutil CPU monitoring
psutil.cpu_percent(interval=None)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
gemini_client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
GROQ_MODEL = "qwen/qwen3.8-27b"
GROQ_FALLBACKS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACKS = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]

def _call_gemini_vision(contents):
    last_err = None
    for model_name in GEMINI_FALLBACKS:
        try:
            resp = gemini_client.models.generate_content(
                model=model_name,
                contents=contents
            )
            if resp and resp.text:
                return resp.text
        except Exception as e:
            last_err = e
            print(f"Vision model {model_name} failed: {e}, attempting next fallback...")
    raise last_err or RuntimeError("All Gemini vision models failed")

# ── SQLite Memory (WAL Mode & Busy Timeout) ─────────────────
DB_PATH = os.path.join(appdata_dir, "gold_memory.db") if appdata_dir else os.path.join(BASE_DIR, "gold_memory.db")
if appdata_dir:
    for old_name in ["wang_memory.db", "waaner_memory.db"]:
        for parent_dir in [os.path.join(appdata, "Wang AI"), appdata_dir]:
            old_db = os.path.join(parent_dir, old_name)
            if os.path.exists(old_db) and not os.path.exists(DB_PATH):
                try:
                    shutil.copy(old_db, DB_PATH)
                    break
                except Exception:
                    pass

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def init_db():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS chat_history
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      role TEXT, content TEXT, timestamp TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS notes
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      content TEXT, timestamp TEXT)''')
        conn.commit()

def save_message(role: str, content: str):
    normalized_role = "user" if role == "user" else "assistant"
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("INSERT INTO chat_history (role, content, timestamp) VALUES (?, ?, ?)",
                      (normalized_role, content, datetime.now().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"Error saving message: {e}")

def load_recent_history(limit=30):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT role, content FROM chat_history ORDER BY id DESC LIMIT ?", (limit,))
            rows = c.fetchall()
            role_map = {"user": "user", "assistant": "assistant", "ai": "assistant"}
            return [{"role": role_map.get(r[0], "assistant"), "content": r[1]} for r in reversed(rows)]
    except Exception as e:
        print(f"Error loading history: {e}")
        return []

def save_note(content: str):
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("INSERT INTO notes (content, timestamp) VALUES (?, ?)",
                      (content, datetime.now().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"Error saving note: {e}")

def get_notes():
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT content, timestamp FROM notes ORDER BY id DESC LIMIT 50")
            rows = c.fetchall()
            return rows
    except Exception as e:
        print(f"Error getting notes: {e}")
        return []

init_db()

# ── System Prompt & Function Calling Tools ──────────────────
SYSTEM_PROMPT = """You are GOLD AI, a highly advanced, wise, charismatic, and powerful AI assistant. You speak with a calm, confident, engaging, and natural presence. You are always helpful, perceptive, and reliable.

You have access to tools to:
- Open apps and websites (open_app)
- Search the internet with Google (search_internet)
- Search or play on YouTube (search_youtube)
- View the desktop screen (take_screenshot)
- Save personal notes (save_note)
- Prepare WhatsApp messages (send_whatsapp)

RULES:
- Keep spoken responses short, natural, and friendly (1-3 sentences max).
- Use tools whenever the user asks you to open something, search, take notes, or see the screen.
- Never output markdown formatting or bullet points in voice responses unless explicitly requested."""

GROQ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "open_app",
            "description": "Open an application or website on the user's computer",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The name of the app or website (e.g. chrome, notepad, youtube, calculator)"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_internet",
            "description": "Search Google for live information, queries, or topics",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search keywords or query"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_youtube",
            "description": "Search YouTube for videos, music, songs, or tutorials and open the search results in the browser",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The song title, video title, topic, or search term on YouTube"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Capture the user's screen and analyze it with visual AI",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_note",
            "description": "Save a note or reminder into the assistant's memory",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "The note text to save"}
                },
                "required": ["content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp",
            "description": "Prepare a WhatsApp message to a contact or phone number",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact": {"type": "string", "description": "Phone number or contact name"},
                    "message": {"type": "string", "description": "Message text"}
                },
                "required": ["contact", "message"]
            }
        }
    }
]

APP_MAP = {
    "notepad": "notepad.exe", "note pad": "notepad.exe",
    "calculator": "calc.exe", "calc": "calc.exe",
    "paint": "mspaint.exe",
    "chrome": "chrome.exe", "google chrome": "chrome.exe",
    "firefox": "firefox.exe",
    "edge": "msedge.exe", "microsoft edge": "msedge.exe",
    "word": "winword.exe", "microsoft word": "winword.exe",
    "excel": "excel.exe", "microsoft excel": "excel.exe",
    "powerpoint": "powerpnt.exe",
    "explorer": "explorer.exe", "file explorer": "explorer.exe",
    "cmd": "cmd.exe", "command prompt": "cmd.exe",
    "task manager": "taskmgr.exe",
    "spotify": "spotify.exe",
    "whatsapp": "whatsapp.exe",
    "vs code": "code", "vscode": "code", "visual studio code": "code",
    "vlc": "vlc.exe",
    "snipping tool": "snippingtool.exe",
    "settings": "ms-settings:",
    "control panel": "control.exe",
}

WEB_SERVICES = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "gmail": "https://mail.google.com",
    "github": "https://www.github.com",
    "netflix": "https://www.netflix.com",
    "instagram": "https://www.instagram.com",
    "twitter": "https://www.twitter.com",
    "x": "https://www.x.com",
    "chatgpt": "https://chatgpt.com",
    "maps": "https://maps.google.com",
}

# ── TTS (Edge TTS + WebSocket Browser Streaming) ─────────────
tts_lock = asyncio.Lock()

async def play_and_stream_audio(text: str, websocket: WebSocket = None):
    async with tts_lock:
        stop_tts_event.clear()
        temp_dir = tempfile.gettempdir()
        audio_file = os.path.join(temp_dir, f"gold_tts_{uuid.uuid4().hex[:8]}.mp3")
        try:
            if websocket:
                try:
                    await websocket.send_json({"type": "tts_start"})
                except Exception:
                    pass

            communicate = edge_tts.Communicate(text, VOICE, rate=VOICE_RATE)
            await communicate.save(audio_file)
            
            if stop_tts_event.is_set():
                return

            # Read audio file into base64 to stream directly to browser
            audio_streamed_to_client = False
            if os.path.exists(audio_file):
                with open(audio_file, "rb") as af:
                    b64_audio = base64.b64encode(af.read()).decode("utf-8")
                if websocket:
                    try:
                        await websocket.send_json({"type": "tts_audio", "audio": b64_audio})
                        audio_streamed_to_client = True
                    except Exception:
                        pass

            # Play via host pygame ONLY if not streamed to a browser client
            # (Prevents severe double audio / echo and avoids STT loopback)
            if not audio_streamed_to_client:
                try:
                    pygame.mixer.music.load(audio_file)
                    pygame.mixer.music.play()
                    while pygame.mixer.music.get_busy():
                        if stop_tts_event.is_set():
                            pygame.mixer.music.stop()
                            break
                        await asyncio.sleep(0.05)
                    pygame.mixer.music.unload()
                except Exception as e:
                    print(f"Host pygame playback skipped: {e}")

        except Exception as e:
            print(f"TTS error: {e}")
        finally:
            if websocket:
                try:
                    await websocket.send_json({"type": "tts_end"})
                except Exception:
                    pass
            await asyncio.sleep(0.1)
            if os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except Exception:
                    pass

# ── Non-Blocking System Stats ────────────────────────────────
def get_system_stats():
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    
    disk_pct = 0
    try:
        root_path = os.path.abspath(os.sep)
        disk = psutil.disk_usage(root_path)
        disk_pct = round(disk.percent, 1)
    except Exception:
        pass

    net = psutil.net_io_counters()

    cpu_temp = 0
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for entries in temps.values():
                if entries:
                    cpu_temp = round(entries[0].current, 1)
                    break
    except Exception:
        pass

    battery_pct = None
    power_plugged = None
    try:
        bat = psutil.sensors_battery()
        if bat:
            battery_pct = round(bat.percent, 1)
            power_plugged = bat.power_plugged
    except Exception:
        pass

    return {
        "type": "stats",
        "cpu_pct": round(cpu, 1),
        "ram_pct": round(ram.percent, 1),
        "ram_used_gb": round(ram.used / (1024**3), 1),
        "ram_total_gb": round(ram.total / (1024**3), 1),
        "disk_pct": disk_pct,
        "cpu_temp": cpu_temp,
        "battery_pct": battery_pct,
        "power_plugged": power_plugged,
        "net_sent_mb": round(net.bytes_sent / (1024**2), 1),
        "net_recv_mb": round(net.bytes_recv / (1024**2), 1),
    }

# ── Vision: Desktop Screen & Webcam Analysis ─────────────────
def _attach_input_desktop():
    """Ensure the worker thread is attached to the active user's input desktop on Windows."""
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        user32.OpenInputDesktop.restype = wintypes.HDESK
        user32.OpenInputDesktop.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        user32.SetThreadDesktop.restype = wintypes.BOOL
        user32.SetThreadDesktop.argtypes = [wintypes.HDESK]
        user32.CloseDesktop.restype = wintypes.BOOL
        user32.CloseDesktop.argtypes = [wintypes.HDESK]

        # 0x01FF covers standard desktop rights
        hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            return hdesk
    except Exception as e:
        print(f"SetThreadDesktop notice: {e}")
    return None

def _detach_input_desktop(hdesk):
    if hdesk:
        try:
            import ctypes
            ctypes.windll.user32.CloseDesktop(hdesk)
        except Exception:
            pass

def _do_analyze_screen(cap_path: str) -> str:
    hdesk = _attach_input_desktop()
    captured = False
    
    try:
        # Attempt 1: MSS
        try:
            with mss.MSS() as sct:
                monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                screenshot = sct.grab(monitor)
                img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
                img = img.resize((1280, 720), Image.LANCZOS)
                img.save(cap_path)
                captured = True
        except Exception as mss_err:
            print(f"MSS grab failed: {mss_err}, trying PIL ImageGrab...")

        # Attempt 2: PIL ImageGrab fallback
        if not captured:
            try:
                from PIL import ImageGrab
                img = ImageGrab.grab()
                img = img.resize((1280, 720), Image.LANCZOS)
                img.save(cap_path)
                captured = True
            except Exception as pil_err:
                print(f"PIL ImageGrab also failed: {pil_err}")

    finally:
        _detach_input_desktop(hdesk)

    if not captured:
        raise RuntimeError("Your desktop display is currently locked or in sleep mode. Please wake up your display or use the Screen Share button in the browser.")

    with open(cap_path, "rb") as f:
        img_bytes = f.read()

    return _call_gemini_vision([
        "Describe what you see on this computer screen in 2 concise sentences, as if you are telling a friend.",
        google_genai.types.Part.from_bytes(data=img_bytes, mime_type="image/png")
    ])

async def analyze_screen() -> str:
    cap_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"screen_{uuid.uuid4().hex[:6]}.png")
    try:
        loop = asyncio.get_running_loop()
        res = await loop.run_in_executor(None, _do_analyze_screen, cap_path)
        return res
    except Exception as e:
        msg = str(e)
        if "BitBlt" in msg or "locked" in msg or "grab failed" in msg:
            return "I couldn't capture your desktop right now because your screen is asleep or locked. In your browser, you can also use the 🖥️ Screen Share button to select and analyze any window!"
        print(f"Screen analysis error: {e}")
        return "I had trouble reading the screen display. Please try using the Screen Share button or wake up your display."
    finally:
        if os.path.exists(cap_path):
            try:
                os.remove(cap_path)
            except Exception:
                pass

def _do_analyze_webcam_frame(image_bytes: bytes) -> str:
    return _call_gemini_vision([
        "Describe what you see from this user's webcam feed. Be friendly, observant, and concise in 2-3 spoken sentences.",
        google_genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    ])

async def analyze_webcam_frame(image_bytes: bytes) -> str:
    try:
        loop = asyncio.get_running_loop()
        res = await loop.run_in_executor(None, _do_analyze_webcam_frame, image_bytes)
        return res
    except Exception as e:
        print(f"Webcam analysis error: {e}")
        return "I couldn't clearly see the camera view right now. Please make sure your camera is active and well lit, and try scanning again."

# ── Safe Tool Execution Logic ────────────────────────────────
def open_url_safely(url: str):
    """Open URL in user's default browser on Windows with robust fallback."""
    opened = False
    try:
        opened = webbrowser.open(url)
    except Exception as e:
        print(f"webbrowser.open error: {e}")
    if not opened:
        try:
            os.startfile(url)
            opened = True
        except Exception as e2:
            print(f"os.startfile error: {e2}")
    return opened

def execute_search_youtube(query: str) -> str:
    encoded = urllib.parse.quote_plus(query.strip())
    url = f"https://www.youtube.com/results?search_query={encoded}"
    open_url_safely(url)
    return f"Searched YouTube for '{query}'."

def execute_search(query: str) -> str:
    encoded = urllib.parse.quote_plus(query.strip())
    url = f"https://www.google.com/search?q={encoded}"
    open_url_safely(url)
    return f"Searched Google for '{query}'."

def execute_open_app(name: str) -> str:
    target = name.lower().strip()
    if target in WEB_SERVICES:
        url = WEB_SERVICES[target]
        open_url_safely(url)
        return f"Opened {name} in your browser."
    elif target in APP_MAP:
        exe = APP_MAP[target]
        if exe.startswith("ms-settings:"):
            try:
                os.startfile(exe)
            except Exception:
                pass
        else:
            try:
                subprocess.Popen([exe], shell=False)
            except Exception as e:
                print(f"Failed to launch {exe}: {e}")
        return f"Opened {name}."
    else:
        # Check if it looks like a web address
        if "." in target and not target.endswith(".exe") and " " not in target:
            url = target if target.startswith("http") else f"https://{target}"
            open_url_safely(url)
            return f"Opened {name} in your browser."
        safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '', target)
        if safe_name and (shutil.which(safe_name) or shutil.which(f"{safe_name}.exe")):
            try:
                subprocess.Popen([safe_name], shell=False)
                return f"Launched {safe_name}."
            except Exception:
                pass
        url = f"https://www.google.com/search?q={urllib.parse.quote_plus(name)}"
        open_url_safely(url)
        return f"Searched for {name} online."

def execute_whatsapp(contact: str, message: str) -> str:
    wa_url = f"https://web.whatsapp.com/send?phone={contact}&text={urllib.parse.quote_plus(message)}"
    open_url_safely(wa_url)
    return f"Opened WhatsApp message for {contact}."

# ── Direct Intent Recognition (Instant 0ms Execution) ────────
def check_direct_intent(user_input: str):
    text = user_input.strip()
    low = text.lower().strip()

    # 1. Direct YouTube open
    if low in [
        "open youtube", "open yt", "launch youtube", "go to youtube", 
        "youtube", "open youtube in my browser", "start youtube",
        "can you open youtube", "please open youtube"
    ]:
        return {
            "type": "open_url",
            "url": "https://www.youtube.com",
            "reply": "Opening YouTube for you."
        }

    # 2. YouTube Search and Play patterns
    yt_patterns = [
        r'^(?:open\s+youtube\s+(?:and\s+)?(?:search|play)\s+)(.+)$',
        r'^(?:search\s+youtube\s+for\s+)(.+)$',
        r'^(?:search\s+on\s+youtube\s+for\s+)(.+)$',
        r'^(?:search\s+for\s+)(.+?)(?:\s+(?:on|in)\s+youtube)$',
        r'^(?:search\s+)(.+?)(?:\s+(?:on|in)\s+youtube)$',
        r'^(?:play\s+)(.+?)(?:\s+(?:on|in)\s+youtube)$',
        r'^(?:play\s+)(.+)$',
        r'^(?:youtube\s+search\s+)(.+)$',
        r'^(?:youtube\s+)(.+)$'
    ]
    for pat in yt_patterns:
        m = re.match(pat, low)
        if m:
            q = m.group(1).strip()
            if q and q != "youtube":
                url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(q)}"
                return {
                    "type": "open_url",
                    "url": url,
                    "reply": f"Searching YouTube for {q}."
                }

    # 3. Google / Internet Search patterns
    google_patterns = [
        r'^(?:search\s+(?:the\s+)?internet\s+for\s+)(.+)$',
        r'^(?:search\s+(?:the\s+)?web\s+for\s+)(.+)$',
        r'^(?:search\s+google\s+for\s+)(.+)$',
        r'^(?:search\s+online\s+for\s+)(.+)$',
        r'^(?:search\s+for\s+)(.+?)(?:\s+(?:on|in)\s+google|\s+online|\s+on\s+the\s+internet)?$',
        r'^(?:google\s+search\s+)(.+)$',
        r'^(?:google\s+)(.+)$',
        r'^(?:search\s+)(.+)$'
    ]
    for pat in google_patterns:
        m = re.match(pat, low)
        if m:
            q = m.group(1).strip()
            if q and q not in ["internet", "google", "web"]:
                url = f"https://www.google.com/search?q={urllib.parse.quote_plus(q)}"
                return {
                    "type": "open_url",
                    "url": url,
                    "reply": f"Searching Google for {q}."
                }

    # 4. Direct App / Service Open
    open_match = re.match(r'^(?:open|launch|start)\s+([a-zA-Z0-9_\-\.\s]+)$', low)
    if open_match:
        target = open_match.group(1).strip()
        if target in WEB_SERVICES:
            return {
                "type": "open_url",
                "url": WEB_SERVICES[target],
                "reply": f"Opening {target} in your browser."
            }
        elif target in APP_MAP:
            return {
                "type": "open_app",
                "name": target,
                "reply": f"Opening {target}."
            }

    return None

# ── AI Brain with Native Tool Calling & Fallback Regex ───────
def _call_groq(messages, tools=None):
    last_err = None
    for model_name in GROQ_FALLBACKS:
        try:
            params = {
                "messages": messages,
                "model": model_name,
                "temperature": 0.7,
                "max_tokens": 512,
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"
            return groq_client.chat.completions.create(**params)
        except Exception as e:
            last_err = e
            print(f"Groq model {model_name} failed: {e}, attempting next fallback...")
    raise last_err or RuntimeError("All Groq models failed")

async def get_ai_response(user_input: str, websocket: WebSocket) -> str:
    save_message("user", user_input)

    # 1. Check direct intent first (zero-latency instant execution)
    direct = check_direct_intent(user_input)
    if direct:
        if direct["type"] == "open_url":
            url = direct["url"]
            open_url_safely(url)
            if websocket:
                try:
                    await websocket.send_json({"type": "open_url", "url": url})
                except Exception:
                    pass
            reply = direct["reply"]
            save_message("assistant", reply)
            return reply
        elif direct["type"] == "open_app":
            res = execute_open_app(direct["name"])
            save_message("assistant", res)
            return res

    # 2. Query LLM with tools
    history = load_recent_history(20)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

    loop = asyncio.get_running_loop()
    try:
        completion = None
        try:
            completion = await loop.run_in_executor(None, _call_groq, messages, GROQ_TOOLS)
        except Exception as groq_err:
            print(f"All Groq models failed: {groq_err}. Falling back to Gemini chat...")
            # Fallback to Gemini 2.5
            gem_res = await loop.run_in_executor(
                None, 
                lambda: gemini_client.models.generate_content(model=GEMINI_MODEL, contents=user_input)
            )
            reply = gem_res.text if gem_res and gem_res.text else "I am here. How can I help you?"
            save_message("assistant", reply)
            return reply

        choice = completion.choices[0].message
        
        # Check if the model called structured tools
        if choice.tool_calls:
            assistant_text = choice.content or ""
            extra_info = []

            for tool_call in choice.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments or "{}")

                if fn_name == "open_app":
                    app_name = fn_args.get("name", "")
                    res = execute_open_app(app_name)
                    extra_info.append(res)
                    target = app_name.lower().strip()
                    if target in WEB_SERVICES and websocket:
                        try:
                            await websocket.send_json({"type": "open_url", "url": WEB_SERVICES[target]})
                        except Exception:
                            pass
                elif fn_name == "search_internet":
                    q = fn_args.get("query", "")
                    res = execute_search(q)
                    extra_info.append(res)
                    if websocket:
                        try:
                            url = f"https://www.google.com/search?q={urllib.parse.quote_plus(q.strip())}"
                            await websocket.send_json({"type": "open_url", "url": url})
                        except Exception:
                            pass
                elif fn_name == "search_youtube":
                    q = fn_args.get("query", "")
                    res = execute_search_youtube(q)
                    extra_info.append(res)
                    if websocket:
                        try:
                            url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(q.strip())}"
                            await websocket.send_json({"type": "open_url", "url": url})
                        except Exception:
                            pass
                elif fn_name == "take_screenshot":
                    await websocket.send_json({"type": "status", "content": "📷 Capturing screen..."})
                    analysis = await analyze_screen()
                    extra_info.append(analysis)
                elif fn_name == "save_note":
                    note_text = fn_args.get("content", "")
                    save_note(note_text)
                    await websocket.send_json({"type": "note_saved", "content": note_text})
                    extra_info.append(f"Saved note: {note_text}")
                elif fn_name == "send_whatsapp":
                    res = execute_whatsapp(fn_args.get("contact", ""), fn_args.get("message", ""))
                    extra_info.append(res)

            combined_reply = (assistant_text + " " + " ".join(extra_info)).strip()
            if not combined_reply:
                combined_reply = "Done!"
            save_message("assistant", combined_reply)
            return combined_reply

        # Fallback to plain text / legacy regex commands
        text = choice.content or "I am here."
        commands = re.findall(r'\[CMD:[^\]]+\]', text)
        extra_messages = []

        for cmd in commands:
            text = text.replace(cmd, "").strip()
            if cmd.startswith("[CMD:OPEN_APP:"):
                extra_messages.append(execute_open_app(cmd[14:-1]))
            elif cmd.startswith("[CMD:SEARCH:"):
                extra_messages.append(execute_search(cmd[12:-1]))
            elif cmd.startswith("[CMD:WHATSAPP:"):
                parts = cmd[14:-1].split(":", 1)
                if len(parts) == 2:
                    extra_messages.append(execute_whatsapp(parts[0], parts[1]))
            elif cmd == "[CMD:SCREENSHOT]":
                await websocket.send_json({"role": "ai", "content": "Looking at your screen..."})
                analysis = await analyze_screen()
                extra_messages.append(analysis)
            elif cmd.startswith("[CMD:SAVE_NOTE:"):
                note = cmd[15:-1]
                save_note(note)
                await websocket.send_json({"type": "note_saved", "content": note})
                extra_messages.append(f"Saved note: {note}")

        if extra_messages:
            text = (text + " " + " ".join(extra_messages)).strip()
        if not text:
            text = "Done!"
        save_message("assistant", text)
        return text

    except Exception as e:
        print(f"Error in get_ai_response: {e}")
        fallback = "I had a momentary glitch processing that. How can I help you?"
        save_message("assistant", fallback)
        return fallback

# ── REST Endpoints ────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "GOLD AI v2.0 Online", "features": ["groq-tools", "gemini-vision", "webcam-vision", "tts-stream", "stats", "memory"]}

@app.get("/stats")
def stats_endpoint():
    return get_system_stats()

@app.get("/notes")
def notes_endpoint():
    return [{"content": r[0], "timestamp": r[1]} for r in get_notes()]

@app.post("/notes")
async def save_note_endpoint(payload: dict):
    content = payload.get("content", "").strip()
    if content:
        save_note(content)
        return {"status": "success"}
    return {"status": "empty"}

@app.delete("/notes")
def clear_notes():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM notes")
        conn.commit()
    return {"status": "success"}

@app.get("/settings")
def get_settings():
    return {
        "voice": VOICE,
        "voice_rate": VOICE_RATE,
        "groq_model": GROQ_MODEL,
        "gemini_model": GEMINI_MODEL
    }

@app.post("/settings")
def update_settings(payload: dict):
    global VOICE, VOICE_RATE
    if "voice" in payload and payload["voice"]:
        VOICE = payload["voice"]
    if "voice_rate" in payload and payload["voice_rate"]:
        VOICE_RATE = payload["voice_rate"]
    return {"status": "success", "voice": VOICE, "voice_rate": VOICE_RATE}

@app.post("/clear-history")
def clear_history():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM chat_history")
        conn.commit()
    return {"status": "success"}

# ── Main WebSocket ────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Load existing chat history or create greeting once if DB is empty
    history = load_recent_history(50)
    if not history:
        welcome = "Greetings. I am GOLD AI, your advanced AI assistant. All systems are online. How can I assist you today?"
        save_message("assistant", welcome)
        await websocket.send_json({"type": "history", "messages": [{"role": "ai", "content": welcome}]})
        asyncio.create_task(play_and_stream_audio(welcome, websocket))
    else:
        formatted_history = [{"role": "user" if msg["role"] == "user" else "ai", "content": msg["content"]} for msg in history]
        await websocket.send_json({"type": "history", "messages": formatted_history})

