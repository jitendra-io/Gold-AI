# <p align="center"><img src="public/logo.png" width="120" alt="GOLD AI Logo" style="border-radius: 50%; box-shadow: 0 0 20px rgba(0,243,255,0.4);" /><br>GOLD AI — Advanced AI Desktop Assistant</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-00f3ff?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Version-1.0.0-ffaa00?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb?style=flat-square" alt="Frontend" />
  <img src="https://img.shields.io/badge/Shell-Electron%2044-47848f?style=flat-square" alt="Electron" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.12-009688?style=flat-square" alt="Backend" />
  <img src="https://img.shields.io/badge/Brain-Groq%20%2B%20Google%20Gemini-ff4f00?style=flat-square" alt="AI Brain" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

**GOLD AI** is an intelligent, futuristic desktop AI companion featuring a cyberpunk HUD interface, charismatic real-time voice conversation, multimodal vision analysis, instant web automation, and live system hardware telemetry.

---

## 🌟 Key Features

### 🎙️ Charismatic Real-Time Voice Interaction
- Natural neural voice synthesis powered by Microsoft Edge Neural TTS (`en-IN-PrabhatNeural` tuned with an energetic, wise presence).
- Real-time speech recognition with acoustic noise cancellation, self-hearing loopback prevention, and instant interrupt capability.
- Dedicated hardware mute toggle with persistent memory.

### 👁️ Multimodal Vision & Screen Analysis
- **Live Webcam Vision Feed**: Real-time object and scene inspection with adaptive lighting boost (Normal, Boost, and Night Mode) plus on-screen face illumination.
- **Desktop & Screen Analyzer**: Captures active displays or specific windows to examine code, error logs, images, and documents using Google Gemini Vision.

### ⚡ Direct Intent Automation
- **YouTube Integration**: Voice or text commands like *"Open YouTube"*, *"Search Coldplay on YouTube"*, or *"Play Lo-Fi music"* open directly in your default browser.
- **Web & Knowledge Search**: Queries like *"Search internet for latest AI news"* or *"Google weather in Tokyo"* execute instantly without latency.
- **System App Launcher**: Quick launch controls for Notepad, Calculator, Chrome, VS Code, and Windows Settings.

### 📊 Live Hardware Telemetry
- Real-time CPU load percentage, RAM memory allocation, Disk capacity, Network send/receive rates, and battery status refreshed every 2 seconds.

### 📝 Persistent Memory & Notepad
- Local SQLite database stored in `%APPDATA%\GOLD AI\` preserving your notes and conversation history across app launches and updates.
- Export notes directly to `.txt` or copy with one click.

### 🔄 In-App Automatic Update Checker
- Silently queries GitHub Releases on startup.
- Displays a prominent notification banner with release notes and 1-click update download when a new version is published.

---

## 🚀 Quick Download & Installation

Download the latest pre-compiled Windows binaries from the [Releases](https://github.com/jitendra-io/Gold-AI/releases) page:

| Package | Description | Recommended For |
|---|---|---|
| **`GOLD-AI-Setup.exe`** | Windows NSIS Installer | Standard install with Desktop shortcut, Start Menu entry, and uninstaller. |
| **`GOLD-AI-Portable.exe`** | Standalone Single Executable | Zero-install portable use on any Windows PC or USB drive. |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Framer Motion, Lucide Icons, Cyberpunk Vanilla CSS
- **Desktop Shell**: Electron 44 + `electron-builder`
- **Backend Core**: Python 3.12, FastAPI, Uvicorn, WebSockets, Pygame, PyInstaller
- **AI Brain**:
  - **Reasoning**: Groq Cloud (`qwen/qwen3.8-27b` with automatic fallback)
  - **Vision Engine**: Google Gemini 2.5 Flash
  - **Speech Engine**: Microsoft Edge Neural TTS

---

## 💻 Getting Started (Development Setup)

### Prerequisites
1. **Node.js** (v18 or newer)
2. **Python** (v3.10 - v3.12)
3. API Keys:
   - [Groq API Key](https://console.groq.com)
   - [Google Gemini API Key](https://aistudio.google.com)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/jitendra-io/Gold-AI.git
cd Gold-AI
```

### Step 2: Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 3: Install Frontend Dependencies
```bash
npm install
```

### Step 4: Install Python Backend Dependencies
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn websockets python-dotenv pygame psutil mss pillow SpeechRecognition edge-tts groq google-genai
cd ..
```

### Step 5: Run in Development Mode
```bash
# Terminal 1: Run Python Backend
cd backend
.\venv\Scripts\python -m uvicorn server:app --host 127.0.0.1 --port 8000

# Terminal 2: Run Electron + React
npm run dev
```

---

## 📦 Building the Windows Executable (`.exe`)

To compile the standalone Windows packages:

1. **Compile the Python Backend**:
   ```bash
   npm run build:backend
   ```
   *(Uses PyInstaller to bundle the backend into `dist-backend/backend/backend.exe`)*

2. **Package the Electron App**:
   ```bash
   npm run dist
   ```

3. **Output Files**:
   Compiled executables will be generated in the `release/` folder:
   - `release/GOLD-AI-Setup.exe` (NSIS Installer)
   - `release/GOLD-AI-Portable.exe` (Single Portable `.exe`)
   - `release/win-unpacked/GOLD AI.exe` (Direct Unpacked Binary)

---

## ⌨️ Debugging & Shortcuts

- **F12** or **Ctrl + Shift + I**: Open Chromium Developer Tools / Console.
- **F5** or **Ctrl + R**: Reload interface.
- Backend runtime logs: `%APPDATA%\GOLD AI\backend_stderr.log`.

---

## 📄 License

MIT License. Designed and Developed by Jitendra Kumar Mishra.
