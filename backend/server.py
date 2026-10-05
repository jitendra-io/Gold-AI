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
