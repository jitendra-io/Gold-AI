import sys, os, asyncio, sqlite3
import psutil, groq, edge_tts, speech_recognition as sr
from google import genai as google_genai
from dotenv import load_dotenv

load_dotenv()

results = []

def ok(msg): results.append(f"  [OK]   {msg}")
def fail(msg): results.append(f"  [FAIL] {msg}")
def warn(msg): results.append(f"  [WARN] {msg}")

print("\n========= GOLD SYSTEM DIAGNOSTIC =========\n")

# ── 1. Packages ──
try: import fastapi; ok("FastAPI installed")
except: fail("FastAPI missing")

try: import pygame; ok("pygame (audio) installed")
except: fail("pygame missing")

try: import mss; ok("mss (screen capture) installed")
except: fail("mss missing")

try: from PIL import Image; ok("Pillow (image) installed")
except: fail("Pillow missing")

# ── 2. API Keys ──
groq_key = os.getenv("GROQ_API_KEY", "")
gem_key  = os.getenv("GEMINI_API_KEY", "")
ok(f"Groq Key loaded: {groq_key[:12]}...") if groq_key else fail("Groq API key missing from .env")
ok(f"Gemini Key loaded: {gem_key[:12]}...") if gem_key else fail("Gemini API key missing from .env")

# ── 3. System Stats ──
try:
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("C:\\")
    ok(f"System Stats — CPU: {cpu}% | RAM: {ram.percent}% | Disk: {disk.percent}%")
except Exception as e:
    fail(f"psutil stats: {e}")

# ── 4. Groq API ──
try:
    client = groq.Groq(api_key=groq_key)
    r = client.chat.completions.create(
        messages=[{"role": "user", "content": "Reply with exactly: GROQ ONLINE"}],
        model="qwen/qwen3.8-27b", max_tokens=15
    )
    ok(f"Groq API (qwen3.8-27b) — {r.choices[0].message.content.strip()}")
except Exception as e:
    fail(f"Groq API: {e}")

# ── 5. Gemini API ──
try:
    gc = google_genai.Client(api_key=gem_key)
    try:
        r2 = gc.models.generate_content(model="gemini-2.5-flash", contents="Reply with exactly: GEMINI ONLINE")
        ok(f"Gemini API (2.5-flash) — {r2.text.strip()}")
    except Exception as e1:
        try:
            r2 = gc.models.generate_content(model="gemini-3.5-flash-lite", contents="Reply with exactly: GEMINI ONLINE")
            ok(f"Gemini API (3.5-flash-lite fallback) — {r2.text.strip()}")
        except Exception as e2:
            fail(f"Gemini API: {e1} / {e2}")
except Exception as e:
    fail(f"Gemini API: {e}")

# ── 6. TTS Voice ──
async def check_tts():
    try:
        voices = await edge_tts.list_voices()
        neerja = [v for v in voices if "Neerja" in v.get("ShortName", "")]
        name = neerja[0]["ShortName"] if neerja else "not found"
        if neerja:
            ok(f"TTS Voice found: {name}")
        else:
            warn("Neerja voice not found")
    except Exception as e:
        fail(f"TTS check: {e}")

asyncio.run(check_tts())

# ── 7. SQLite Memory DB ──
try:
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gold_memory.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, timestamp TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, timestamp TEXT)")
    conn.commit()
    c.execute("SELECT COUNT(*) FROM chat_history")
    count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM notes")
    notes_count = c.fetchone()[0]
    conn.close()
    ok(f"SQLite DB — {count} chat messages | {notes_count} notes stored")
except Exception as e:
    fail(f"SQLite DB: {e}")

# ── 8. Microphone ──
try:
    mic = sr.Microphone()
    ok("Microphone accessible")
except Exception as e:
    fail(f"Microphone: {e}")

# ── 9. Screen Capture ──
try:
    import mss
    with mss.MSS() as sct:
        monitors = sct.monitors
        ok(f"Screen capture — {len(monitors)-1} monitor(s) detected")
except Exception as e:
    fail(f"Screen capture: {e}")

# ── Print Results ──
print("\n".join(results))
print("\n========= DIAGNOSTIC COMPLETE =========\n")
