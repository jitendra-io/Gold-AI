import { useState, useEffect, useRef } from 'react'
import {
  Activity, Cpu, MessageSquare, Mic, Camera, FileText, Wifi, Send, Eye,
  Video, VideoOff, Scan, Sun, Moon, Copy, Download, Trash2, Settings as SettingsIcon,
  Check, Sparkles, Volume2, VolumeX, Square, Plus, Monitor, RefreshCw, ExternalLink, ArrowUpCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './index.css'

// ── Animated Atom Visualizer ─────────────────────────────────
function AtomVisualizer({ speaking, isVisible = true }) {
  const orbits = [
    { duration: 6,  rx: 150, ry: 60,  rotY: 0,   color: '#00f3ff', eSize: 10 },
    { duration: 9,  rx: 150, ry: 60,  rotY: 60,  color: '#00f3ff', eSize: 8  },
    { duration: 12, rx: 150, ry: 60,  rotY: 120, color: '#ff4f00', eSize: 9  },
    { duration: 8,  rx: 150, ry: 60,  rotY: 90,  color: '#ff4f00', eSize: 7  },
    { duration: 14, rx: 150, ry: 60,  rotY: 150, color: '#00f3ff', eSize: 8  },
  ]

  return (
    <div style={{ position: 'relative', width: 340, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', transformStyle: 'preserve-3d', perspective: 1000 }}>

      {/* Outer glow rings */}
      <motion.div
        animate={isVisible ? { rotate: 360 } : false}
        transition={{ repeat: Infinity, duration: 30, ease: 'linear' }}
        style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px dashed rgba(0,243,255,0.12)', boxShadow: '0 0 40px rgba(0,243,255,0.05)' }}
      />
      <motion.div
        animate={isVisible ? { rotate: -360 } : false}
        transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
        style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px dashed rgba(255,79,0,0.1)' }}
      />

      {/* Orbits */}
      {orbits.map((o, i) => (
        <motion.div key={i}
          animate={isVisible ? { rotateZ: 360 } : false}
          transition={{ repeat: Infinity, duration: o.duration, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: o.rx * 2,
            height: o.ry * 2,
            border: `1px solid rgba(${o.color === '#00f3ff' ? '0,243,255' : '255,79,0'},0.25)`,
            borderRadius: '50%',
            transformStyle: 'preserve-3d',
            transform: `rotateX(65deg) rotateY(${o.rotY}deg)`,
          }}
        >
          {/* Electron dot */}
          <motion.div
            animate={isVisible ? { rotateZ: -360 } : false}
            transition={{ repeat: Infinity, duration: o.duration, ease: 'linear' }}
            style={{
              position: 'absolute',
              top: -o.eSize / 2,
              left: o.rx - o.eSize / 2,
              width: o.eSize,
              height: o.eSize,
              borderRadius: '50%',
              background: o.color,
              boxShadow: `0 0 ${o.eSize * 3}px ${o.color}`,
            }}
          />
        </motion.div>
      ))}

      {/* Nucleus */}
      <motion.div
        animate={isVisible ? {
          scale: speaking ? [1, 1.6, 1.2, 1.7, 1.1, 1] : [1, 1.1, 1],
          filter: speaking
            ? ['brightness(1)', 'brightness(2.2)', 'brightness(1.5)', 'brightness(2.2)', 'brightness(1)']
            : ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
        } : false}
        transition={{ repeat: Infinity, duration: speaking ? 0.5 : 2.5, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 44, height: 44,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ff7a00, #ff4f00)',
          boxShadow: '0 0 30px #ff4f00, 0 0 60px rgba(255,79,0,0.5)',
          zIndex: 10,
        }}
      />

      {/* Inner Nucleus glow ring */}
      <motion.div
        animate={isVisible ? { scale: speaking ? [1, 1.5, 1] : [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] } : false}
        transition={{ repeat: Infinity, duration: speaking ? 0.7 : 2, ease: 'easeInOut' }}
        style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', border: '1px solid rgba(255,79,0,0.5)', zIndex: 9 }}
      />
    </div>
  )
}

// ── Stat Bar Component ───────────────────────────────────────
function StatBar({ label, value, pct, orange = false }) {
  return (
    <div className="stat-row">
      <div className="stat-label">
        <span className="label">{label}</span>
        <span className={`value ${orange ? 'orange' : ''}`}>{value}</span>
      </div>
      <div className="stat-bar-bg">
        <div className={`stat-bar-fill ${orange ? 'orange' : ''}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  )
}

// ── Main App Component ───────────────────────────────────────
export default function App() {
  const [time, setTime]           = useState(new Date())
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'notes' | 'settings'
  const [messages, setMessages]   = useState([
    { role: 'ai', content: 'Greetings. I am GOLD AI, your AI desktop companion. All systems online. Awaiting your command.' }
  ])
  const [inputValue, setInputValue] = useState('')
  const [speaking, setSpeaking]   = useState(false)
  const [listening, setListening] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [notes, setNotes]         = useState('GOLD NOTES\n────────────────────────\n')
  const [copiedNotes, setCopiedNotes] = useState(false)
  const [quickNoteInput, setQuickNoteInput] = useState('')
  const [hasNewNotes, setHasNewNotes]       = useState(false)
  const [copiedMsgIndex, setCopiedMsgIndex] = useState(null)
  const [stats, setStats]         = useState({ cpu_pct: 0, ram_pct: 0, disk_pct: 0, cpu_temp: 0, battery_pct: null, power_plugged: null, net_sent_mb: 0, net_recv_mb: 0, ram_used_gb: 0, ram_total_gb: 0 })
  const [isVisible, setIsVisible] = useState(!document.hidden)
  const [connectionStatus, setConnectionStatus] = useState('connecting') // 'connected' | 'reconnecting' | 'disconnected'
  
  // Audio Mute State (persisted in localStorage)
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem('gold_ai_muted') === 'true' } catch { return false }
  })
  const isMutedRef = useRef(isMuted)
  useEffect(() => {
    isMutedRef.current = isMuted
    try { localStorage.setItem('gold_ai_muted', String(isMuted)) } catch {}
  }, [isMuted])

  // Real Webcam Vision States & Lighting Enhancement
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraBoost, setCameraBoost]   = useState('boost') // 'normal' | 'boost' | 'night'
  const [fillLight, setFillLight]       = useState(false)
  const videoRef         = useRef(null)
  const cameraStreamRef  = useRef(null)

  // Settings State
  const [selectedVoice, setSelectedVoice] = useState('en-IN-NeerjaExpressiveNeural')
  const [selectedRate, setSelectedRate]   = useState('+30%')
  const [settingsSaved, setSettingsSaved] = useState(false)

  // App Version & Update System (Visual Banner & Settings Check)
  const CURRENT_VERSION = '1.0.0'
  const GITHUB_REPO = 'jitendra-io/Gold-AI'
  const [updateAvailable, setUpdateAvailable] = useState(null)
  const [checkingUpdate, setCheckingUpdate]   = useState(false)
  const [updateStatusText, setUpdateStatusText] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const isNewerVersion = (current, latest) => {
    const c = (current || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
    const l = (latest || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
      const cv = c[i] || 0
      const lv = l[i] || 0
      if (lv > cv) return true
      if (lv < cv) return false
    }
    return false
  }

  const checkForUpdates = async (isManual = false) => {
    setCheckingUpdate(true)
    if (isManual) setUpdateStatusText('Checking GitHub releases...')
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      })
      if (res.ok) {
        const data = await res.json()
        const latestTag = data.tag_name || data.name || ''
        const latestVer = latestTag.replace(/^v/, '')
        const exeAsset = data.assets?.find(a => a.name.endsWith('.exe'))
        const releaseUrl = exeAsset?.browser_download_url || data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`

        if (isNewerVersion(CURRENT_VERSION, latestVer)) {
          setUpdateAvailable({ version: latestVer, url: releaseUrl, name: data.name, notes: data.body })
          setUpdateStatusText(`🚀 Update available: v${latestVer}!`)
        } else {
          setUpdateAvailable(null)
          setUpdateStatusText(`✨ GOLD AI is up to date (v${CURRENT_VERSION})`)
        }
      } else if (res.status === 404) {
        setUpdateStatusText(`Latest version v${CURRENT_VERSION} (No newer release on GitHub).`)
      } else {
        setUpdateStatusText(`Update check response: ${res.status}`)
      }
    } catch (err) {
      console.warn('Update check failed:', err)
      if (isManual) setUpdateStatusText('Update check unavailable (offline).')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const openUpdateUrl = (targetUrl) => {
    const url = targetUrl || updateAvailable?.url || `https://github.com/${GITHUB_REPO}/releases/latest`
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  // Silent update check 3 seconds after launch
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const messagesEndRef        = useRef(null)
  const wsRef                 = useRef(null)
  const reconnectTimeoutRef   = useRef(null)
  const speakingRef           = useRef(speaking)
  const lastSpeechEndTimeRef  = useRef(0)
  const lastAiTextRef         = useRef('')
  const activeTabRef          = useRef(activeTab)
  const recognitionRef        = useRef(null)
  const isRecognizingRef      = useRef(false)
  const notesSaveTimeout      = useRef(null)
  const currentAudioRef       = useRef(null)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Tab visibility listener
  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Keep speakingRef updated
  useEffect(() => {
    speakingRef.current = speaking
  }, [speaking])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch initial notes and settings on mount
  useEffect(() => {
    fetch('http://localhost:8000/notes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map(n => `• [${new Date(n.timestamp).toLocaleTimeString()}] ${n.content}`).join('\n')
          setNotes(`GOLD NOTES\n────────────────────────\n${formatted}`)
        }
      })
      .catch(err => console.log('Could not load notes:', err))

    fetch('http://localhost:8000/settings')
      .then(res => res.json())
      .then(data => {
        if (data.voice) setSelectedVoice(data.voice)
        if (data.voice_rate) setSelectedRate(data.voice_rate)
      })
      .catch(err => console.log('Could not load settings:', err))
  }, [])

  // Debounced note saving
  const handleNotesChange = (newText) => {
    setNotes(newText)
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current)
    notesSaveTimeout.current = setTimeout(() => {
      fetch('http://localhost:8000/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newText })
      }).catch(err => console.log('Error saving note:', err))
    }, 1500)
  }

  // Copy notes to clipboard
  const copyNotesToClipboard = () => {
    navigator.clipboard.writeText(notes)
    setCopiedNotes(true)
    setTimeout(() => setCopiedNotes(false), 2000)
  }

  // Download notes as text file
  const downloadNotes = () => {
    const blob = new Blob([notes], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gold_notes_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Clear notes
  const clearNotes = async () => {
    if (window.confirm('Are you sure you want to clear all notes?')) {
      await fetch('http://localhost:8000/notes', { method: 'DELETE' }).catch(() => {})
      setNotes('GOLD NOTES\n────────────────────────\n')
    }
  }

  // Clear chat history
  const clearChatHistory = async () => {
    if (window.confirm('Clear conversation memory?')) {
      await fetch('http://localhost:8000/clear-history', { method: 'POST' }).catch(() => {})
      setMessages([{ role: 'ai', content: 'Conversation memory cleared. Ready for new commands.' }])
    }
  }

  // Save Settings
  const saveSettings = async () => {
    try {
      await fetch('http://localhost:8000/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: selectedVoice, voice_rate: selectedRate })
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch (e) {
      console.error('Settings save error:', e)
    }
  }

  // Camera Management
  const toggleCamera = async () => {
    if (cameraActive) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
        cameraStreamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setCameraActive(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        })
        cameraStreamRef.current = stream
        setCameraActive(true)
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(e => console.log('Video play caught:', e))
          }
        })
      } catch (err) {
        console.error('Webcam access error:', err)
        alert('Could not access webcam: ' + err.message)
      }
    }
  }

  // Ensure webcam stream is properly attached whenever camera state updates
  useEffect(() => {
    if (cameraActive && cameraStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current
      }
      videoRef.current.play().catch(() => {})
    }
  }, [cameraActive])

  // Cycle brightness boost
  const cycleCameraBoost = () => {
    if (cameraBoost === 'normal') setCameraBoost('boost')
    else if (cameraBoost === 'boost') setCameraBoost('night')
    else setCameraBoost('normal')
  }

  // Get video filter style based on boost setting
  const getVideoFilterStyle = () => {
    if (cameraBoost === 'night') return 'brightness(1.75) contrast(1.25) saturate(1.2)'
    if (cameraBoost === 'boost') return 'brightness(1.4) contrast(1.15) saturate(1.1)'
    return 'brightness(1.1) contrast(1.05)'
  }

  // Capture frame from webcam and send to AI vision
  const scanWebcamFrame = () => {
    if (!cameraActive) {
      alert('Please activate your camera first by clicking "CLICK TO ACTIVATE CAM".')
      return
    }
    if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    try {
      const video = videoRef.current
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setStatusText('⏳ Camera warming up, please click again in a moment...')
        setTimeout(() => setStatusText(''), 3000)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

      setStatusText('👁️ Analyzing webcam view...')
      wsRef.current.send(JSON.stringify({
        type: 'camera_frame',
        image: dataUrl
      }))
    } catch (e) {
      console.error('Frame capture error:', e)
    }
  }

  // Mute / Unmute Toggle
  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev
      if (next && currentAudioRef.current) {
        currentAudioRef.current.pause()
        speakingRef.current = false
        setSpeaking(false)
        lastSpeechEndTimeRef.current = Date.now()
      }
      return next
    })
  }

  // Interrupt / Stop Speaking
  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'voice_interrupt' }))
    }
    speakingRef.current = false
    setSpeaking(false)
    lastSpeechEndTimeRef.current = Date.now()
    setTimeout(() => {
      if (!speakingRef.current && recognitionRef.current && !isRecognizingRef.current) {
        try { recognitionRef.current.start() } catch {}
      }
    }, 800)
  }

  // Quick note add
  const handleAddQuickNote = async () => {
    const text = quickNoteInput.trim()
    if (!text) return
    const timestamped = `• [${new Date().toLocaleTimeString()}] ${text}`
    setNotes(prev => `${prev}\n${timestamped}`)
    setQuickNoteInput('')
    try {
      await fetch('http://localhost:8000/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      })
    } catch (e) {
      console.error('Error saving quick note:', e)
    }
  }

  // Copy chat message
  const copyMessage = (text, index) => {
    navigator.clipboard.writeText(text)
    setCopiedMsgIndex(index)
    setTimeout(() => setCopiedMsgIndex(null), 1500)
  }

  // Share and analyze window / display
  const shareAndAnalyzeScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      setTimeout(() => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
