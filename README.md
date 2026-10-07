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

## 📄 License

MIT License. Designed and Developed by Jitendra Kumar Mishra.
