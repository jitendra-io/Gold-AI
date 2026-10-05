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

