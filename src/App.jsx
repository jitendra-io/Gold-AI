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
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        
        stream.getTracks().forEach(track => track.stop())
        setStatusText('🖥️ Analyzing screen capture...')
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'screen_frame', image: dataUrl }))
        }
      }, 500)
    } catch (err) {
      console.log('Screen capture aborted or unavailable:', err)
    }
  }

  // Test voice sample in settings
  const testVoiceSample = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        content: 'Say hello in one friendly sentence to test the selected voice and speech rate.'
      }))
    }
  }

  // WebSocket Connection with Auto-Reconnect
  useEffect(() => {
    let isUnmounted = false

    const connectWs = () => {
      if (isUnmounted) return
      setConnectionStatus('connecting')
      const socket = new WebSocket('ws://localhost:8000/ws')
      wsRef.current = socket

      socket.onopen = () => {
        setConnectionStatus('connected')
      }

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'stats') {
            setStats(data)
          } else if (data.type === 'status') {
            setStatusText(data.content)
          } else if (data.type === 'history') {
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages)
            }
          } else if (data.type === 'tts_start') {
            speakingRef.current = true
            if (!isMutedRef.current) setSpeaking(true)
            if (recognitionRef.current) {
              try { recognitionRef.current.abort() } catch {}
            }
          } else if (data.type === 'tts_end') {
            if (!currentAudioRef.current || currentAudioRef.current.paused || currentAudioRef.current.ended) {
              speakingRef.current = false
              setSpeaking(false)
              lastSpeechEndTimeRef.current = Date.now()
            }
          } else if (data.type === 'tts_audio') {
            if (data.audio && !isMutedRef.current) {
              try {
                if (currentAudioRef.current) {
                  currentAudioRef.current.pause()
                }
                speakingRef.current = true
                setSpeaking(true)
                if (recognitionRef.current) {
                  try { recognitionRef.current.abort() } catch {}
                }

                const audio = new Audio('data:audio/mp3;base64,' + data.audio)
                currentAudioRef.current = audio

                audio.onplay = () => {
                  speakingRef.current = true
                  setSpeaking(true)
                  if (recognitionRef.current) {
                    try { recognitionRef.current.abort() } catch {}
                  }
                }

                const handlePlaybackEnded = () => {
                  speakingRef.current = false
                  setSpeaking(false)
                  lastSpeechEndTimeRef.current = Date.now()
                  // Acoustic echo cooldown: Allow 1.2s for room reverb to clear before resuming speech recognition
                  setTimeout(() => {
                    if (!speakingRef.current && recognitionRef.current && !isRecognizingRef.current) {
                      try {
                        recognitionRef.current.start()
                      } catch {
                        // Already started or active
                      }
                    }
                  }, 1200)
                }

                audio.onended = handlePlaybackEnded
                audio.onerror = handlePlaybackEnded

                audio.play().catch(err => {
                  console.log('Audio autoplay prevented:', err)
                  handlePlaybackEnded()
                })
              } catch (err) {
                console.log('Audio playback error:', err)
                speakingRef.current = false
                setSpeaking(false)
              }
            }
          } else if (data.type === 'voice_listening') {
            setListening(true)
          } else if (data.type === 'voice_failed') {
            setListening(false)
          } else if (data.type === 'open_url') {
            if (data.url) {
              if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                window.electronAPI.openExternal(data.url);
              } else {
                window.open(data.url, '_blank');
              }
            }
          } else if (data.type === 'note_saved') {
            setNotes(prev => `${prev}\n• [${new Date().toLocaleTimeString()}] ${data.content}`)
            if (activeTabRef.current !== 'notes') {
              setHasNewNotes(true)
            }
          } else if (data.role) {
            setListening(false)
            if (data.role === 'ai' || data.role === 'assistant') {
              lastAiTextRef.current = data.content || ''
            }
            setMessages(prev => [...prev, { role: data.role, content: data.content }])
          }
        } catch (err) {
          console.error('Error parsing WS message:', err)
        }
      }

      socket.onclose = () => {
        if (!isUnmounted) {
          setConnectionStatus('reconnecting')
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000)
        }
      }

      socket.onerror = () => {
        setConnectionStatus('disconnected')
      }
    }

    connectWs()

    return () => {
      isUnmounted = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) wsRef.current.close()
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Web Speech API with Echo and Self-Voice Feedback Suppression
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'
    recognitionRef.current = recognition

    let isStoppedManually = false

    recognition.onstart = () => {
      isRecognizingRef.current = true
    }

    recognition.onspeechstart = () => {
      // If AI is currently speaking or inside the 1.5s post-speech echo cooldown, ignore!
      if (speakingRef.current || (Date.now() - lastSpeechEndTimeRef.current < 1500)) {
        return
      }
      setListening(true)
    }

    recognition.onspeechend = () => {
      setListening(false)
    }

    recognition.onresult = (event) => {
      // Reject any recognized audio while speaking or within 1.5s after speech ends
      const timeSinceSpeech = Date.now() - lastSpeechEndTimeRef.current
      if (speakingRef.current || timeSinceSpeech < 1500) {
        console.log('Suppressed self-voice echo / buffered speech recognition result')
        return
      }

      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }

      const text = finalTranscript.trim()
      if (!text) return

      // Self-echo filter: Drop transcript if it matches or is contained in recent AI speech
      const lowerText = text.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
      const lowerAi = (lastAiTextRef.current || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
      if (lowerAi && lowerText.length > 5) {
        if (lowerAi.includes(lowerText) || lowerText.includes(lowerAi.slice(0, 30))) {
          console.log('Suppressed echo matching AI response:', text)
          return
        }
      }

      setMessages(prev => [...prev, { role: 'user', content: text }])
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'voice_text', content: text }))
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error)
      }
    }

    recognition.onend = () => {
      isRecognizingRef.current = false
      setListening(false)
      if (!isStoppedManually && !speakingRef.current && (Date.now() - lastSpeechEndTimeRef.current >= 1500)) {
        setTimeout(() => {
          if (!speakingRef.current && recognitionRef.current && !isRecognizingRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              // Restart safely
            }
          }
        }, 300)
      }
    }

    try {
      recognition.start()
    } catch {
      // Safely catch init error
    }

    return () => {
      isStoppedManually = true
      isRecognizingRef.current = false
      try {
        recognition.abort()
      } catch {
        // Safely catch cleanup error
      }
    }
  }, [])

  const handleSend = (textToSend = null) => {
    const query = typeof textToSend === 'string' ? textToSend : inputValue
    if (!query.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: query }])
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', content: query }))
    }
    setInputValue('')
  }

  const handleVoice = () => {
    if (!recognitionRef.current) return
    if (speakingRef.current) {
      stopSpeaking()
    }
    setListening(true)
    try {
      recognitionRef.current.start()
    } catch {
      // Already running
    }
  }

  const handleScreenshot = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'screenshot' }))
  }

  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const dateStr = `${days[time.getDay()]} ${String(time.getDate()).padStart(2,'0')} ${months[time.getMonth()]} ${time.getFullYear()}`
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div id="root" style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw' }}>

      {/* ── TOP BAR ── */}
      <div className="topbar">
        {/* Brand */}
        <div className="topbar-brand">
          <div className="wang-brand-avatar-wrap">
            <img src="/logo.png" alt="GOLD AI" className="wang-brand-avatar" />
          </div>
          <div>
            <div className="brand-name">GOLD AI</div>
            <div className="brand-subtitle">Advanced AI Interface v2.0</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginLeft:'1rem' }}>
            <div className={`status-dot ${connectionStatus}`} />
            <span style={{
              fontFamily:'var(--font-mono)',
              fontSize:'0.6rem',
              color: connectionStatus === 'connected' ? '#00ff88' : connectionStatus === 'reconnecting' ? '#ffaa00' : '#ff4444',
              letterSpacing:'2px'
            }}>
              {connectionStatus === 'connected' ? 'ONLINE' : connectionStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Date & Time */}
        <div className="datetime-block">
          <div className="datetime-time">{timeStr}</div>
          <div className="datetime-date">{dateStr}</div>
        </div>

        {/* Right side controls: Audio Mute + Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Audio Mute / Unmute Toggle */}
          <button
            onClick={toggleMute}
            className="mute-btn"
            style={{
              background: isMuted ? 'rgba(255,68,68,0.15)' : 'rgba(0,243,255,0.08)',
              border: `1px solid ${isMuted ? '#ff4444' : 'var(--border-blue)'}`,
              color: isMuted ? '#ff4444' : 'var(--neon-blue)',
              borderRadius: '20px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={isMuted ? "AI Voice is Muted (Click to enable)" : "AI Voice is Active (Click to mute)"}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span>{isMuted ? 'MUTED' : 'VOICE ON'}</span>
          </button>

          {/* Nav Tabs */}
          <div className="topbar-nav">
            <button className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>DASHBOARD</button>
            <button
              className={`nav-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => { setActiveTab('notes'); setHasNewNotes(false); }}
              style={{ position: 'relative' }}
            >
              NOTES
              {hasNewNotes && (
                <span style={{
                  position: 'absolute',
                  top: -2, right: -2,
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: 'var(--neon-orange)',
                  boxShadow: '0 0 8px var(--neon-orange)',
                  animation: 'pulse-green 1.5s infinite'
                }} />
              )}
            </button>
            <button
              className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              style={{ position: 'relative' }}
            >
              SETTINGS
              {updateAvailable && (
                <span style={{
                  position: 'absolute',
                  top: -2, right: -2,
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: '#ffaa00',
                  boxShadow: '0 0 8px #ffaa00'
                }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── UPDATE NOTIFICATION BANNER ── */}
      {updateAvailable && !bannerDismissed && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(255,170,0,0.2) 0%, rgba(0,243,255,0.1) 100%)',
          borderBottom: '1px solid rgba(255,170,0,0.4)',
          padding: '0.35rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          flexShrink: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ArrowUpCircle size={15} color="#ffaa00" />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.5px' }}>
              <strong style={{ color: '#ffaa00' }}>UPDATE AVAILABLE:</strong> GOLD AI v{updateAvailable.version} is available to install!
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => openUpdateUrl(updateAvailable.url)}
              style={{
                background: 'linear-gradient(135deg, #ffaa00, #ff7700)',
                border: 'none',
                color: '#000',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.65rem',
                fontFamily: 'Orbitron, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Download size={11} /> DOWNLOAD UPDATE
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                padding: '2px 6px',
                lineHeight: 1
              }}
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="main-layout">

        {/* ── LEFT COLUMN ── */}
        <div className="left-col">

          {/* Real Live Vision Feed (With Brightness & Fill Light Boost) */}
          <div className="panel" style={{ flex: 1.2, display:'flex', flexDirection:'column', minHeight: 250 }}>
            <div className="panel-header">
              <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <Eye size={12} /> VISION FEED
              </span>
              <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  letterSpacing: '1px',
                  color: cameraActive ? '#00ff88' : 'var(--text-dim)'
                }}>
                  {cameraActive ? 'LIVE' : 'OFFLINE'}
                </span>
                
                {/* Brightness Boost Toggle */}
                {cameraActive && (
                  <button
                    onClick={cycleCameraBoost}
                    style={{
                      background: cameraBoost === 'night' ? 'rgba(255,170,0,0.2)' : cameraBoost === 'boost' ? 'rgba(0,243,255,0.2)' : 'transparent',
                      border: `1px solid ${cameraBoost === 'night' ? '#ffaa00' : 'var(--border-blue)'}`,
                      color: cameraBoost === 'night' ? '#ffaa00' : 'var(--neon-blue)',
                      borderRadius: '4px',
                      padding: '2px 5px',
                      fontSize: '0.55rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                    title="Toggle Lighting Boost (Normal / Boost / Night)"
                  >
                    {cameraBoost === 'night' ? <Moon size={9} /> : <Sun size={9} />}
                    {cameraBoost.toUpperCase()}
                  </button>
                )}

                {/* Fill Light (Screen Torch for dark rooms) */}
                {cameraActive && (
                  <button
                    onClick={() => setFillLight(!fillLight)}
                    style={{
                      background: fillLight ? 'rgba(255,255,255,0.25)' : 'transparent',
                      border: `1px solid ${fillLight ? '#ffffff' : 'var(--border-blue)'}`,
                      color: fillLight ? '#ffffff' : 'var(--text-dim)',
                      borderRadius: '4px',
                      padding: '2px 5px',
                      fontSize: '0.55rem',
                      cursor: 'pointer'
                    }}
                    title="Face Illumination Light"
                  >
                    LIGHT
                  </button>
                )}

                {/* Camera ON/OFF */}
                <button
                  onClick={toggleCamera}
                  style={{
                    background: cameraActive ? 'rgba(0,255,136,0.15)' : 'rgba(0,243,255,0.1)',
                    border: `1px solid ${cameraActive ? '#00ff88' : 'var(--border-blue)'}`,
                    color: cameraActive ? '#00ff88' : 'var(--neon-blue)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title={cameraActive ? "Turn camera off" : "Turn camera on"}
                >
                  {cameraActive ? <VideoOff size={10} /> : <Video size={10} />}
                  {cameraActive ? 'STOP' : 'CAM'}
                </button>
              </div>
            </div>

            <div className="panel-content" style={{ flex: 1, display:'flex', flexDirection:'column', padding: '0.5rem', position: 'relative' }}>
              <div
                className="vision-feed"
                style={{
                  flex: 1,
                  position: 'relative',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: fillLight ? '0 0 35px rgba(255,255,255,0.4), inset 0 0 25px rgba(255,255,255,0.3)' : 'inset 0 0 25px rgba(0,243,255,0.08)',
                  transition: 'box-shadow 0.3s'
                }}
              >
                {cameraActive ? (
                  <>
                    <video
                      ref={(el) => {
                        videoRef.current = el
                        if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                          el.srcObject = cameraStreamRef.current
                          el.play().catch(() => {})
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        filter: getVideoFilterStyle(),
                        transition: 'filter 0.3s'
                      }}
                    />
                    
                    {/* Cyber overlay brackets */}
                    <div style={{ position: 'absolute', top: 6, left: 6, width: 12, height: 12, borderTop: '2px solid var(--neon-blue)', borderLeft: '2px solid var(--neon-blue)' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 12, height: 12, borderTop: '2px solid var(--neon-blue)', borderRight: '2px solid var(--neon-blue)' }} />
                    <div style={{ position: 'absolute', bottom: 6, left: 6, width: 12, height: 12, borderBottom: '2px solid var(--neon-blue)', borderLeft: '2px solid var(--neon-blue)' }} />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, width: 12, height: 12, borderBottom: '2px solid var(--neon-blue)', borderRight: '2px solid var(--neon-blue)' }} />

                    {/* Scan Frame Action Button */}
                    <button
                      onClick={scanWebcamFrame}
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        background: 'rgba(0,5,15,0.85)',
                        border: '1px solid var(--neon-blue)',
                        color: 'var(--neon-blue)',
                        padding: '4px 10px',
                        borderRadius: 16,
                        fontSize: '0.65rem',
                        fontFamily: 'Orbitron, sans-serif',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 0 12px rgba(0,243,255,0.3)',
                        backdropFilter: 'blur(4px)'
                      }}
                      title="Analyze this view with Gemini Vision"
                    >
                      <Scan size={12} /> SCAN FRAME
                    </button>
                  </>
                ) : (
                  <div
                    onClick={toggleCamera}
                    className="vision-no-input"
                    style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '1rem', textAlign: 'center' }}
                    title="Click to activate your webcam"
                  >
                    <Camera size={26} style={{ color: 'var(--neon-blue)', opacity: 0.9 }} />
                    <span>NO INPUT DETECTED</span>
                    <span style={{ fontSize:'0.55rem', letterSpacing: 2, color: 'var(--neon-blue)', opacity: 0.9, marginTop: 4 }}>
                      CLICK TO ACTIVATE CAM
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Monitor */}
          <div className="panel">
            <div className="panel-header"><span><Cpu size={10} style={{marginRight:6}}/>SYSTEM MONITOR</span></div>
            <div className="panel-content">
              <StatBar label="CPU LOAD" value={`${stats.cpu_pct.toFixed(1)}%`} pct={stats.cpu_pct} />
              <StatBar label="RAM USAGE" value={`${stats.ram_pct.toFixed(1)}%`} pct={stats.ram_pct} orange />
              <StatBar label="DISK USED" value={`${stats.disk_pct.toFixed(1)}%`} pct={stats.disk_pct} />
              {stats.battery_pct !== null && (
                <StatBar
                  label={stats.power_plugged ? "BATTERY (AC)" : "BATTERY"}
                  value={`${stats.battery_pct}%`}
                  pct={stats.battery_pct}
                  orange={stats.battery_pct < 25}
                />
              )}
            </div>
          </div>

          {/* Network & Temp */}
          <div className="panel panel-orange">
            <div className="panel-header orange"><span><Wifi size={10} style={{marginRight:6}}/>NETWORK &amp; TEMP</span></div>
            <div className="panel-content">
              <StatBar label="NET SENT" value={`${stats.net_sent_mb} MB`} pct={Math.min(stats.net_sent_mb / 5, 100)} />
              <StatBar label="NET RECV" value={`${stats.net_recv_mb} MB`} pct={Math.min(stats.net_recv_mb / 5, 100)} orange />
              <StatBar label="CPU TEMP" value={stats.cpu_temp > 0 ? `${stats.cpu_temp}°C` : 'N/A'} pct={stats.cpu_temp > 0 ? (stats.cpu_temp / 100) * 100 : 0} orange />
            </div>
          </div>

        </div>

        {/* ── CENTER COLUMN ── */}
        <div className="center-col">
          <div className="panel" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div className="atom-stage">
              {/* Status text above atom */}
              <AnimatePresence>
                {statusText && (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute',
                      top: 10,
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '0.75rem',
                      letterSpacing: '3px',
                      color: 'var(--neon-orange)',
                      textShadow: '0 0 15px var(--neon-orange)',
                      background: 'rgba(255,79,0,0.1)',
                      border: '1px solid rgba(255,79,0,0.3)',
                      borderRadius: '4px',
                      padding: '0.4rem 1rem',
                      zIndex: 20,
                    }}
                  >
                    {statusText}
                  </motion.div>
                )}
              </AnimatePresence>

              <AtomVisualizer speaking={speaking} isVisible={isVisible} />
              
              {/* Quick Stop Speaking Button */}
              {speaking && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    position: 'absolute',
                    top: 60,
                    background: 'rgba(255,79,0,0.25)',
                    border: '1px solid var(--neon-orange)',
                    color: 'var(--neon-orange)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.65rem',
                    fontFamily: 'Orbitron, sans-serif',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    zIndex: 25,
                    boxShadow: '0 0 15px rgba(255,79,0,0.4)',
                    backdropFilter: 'blur(4px)'
                  }}
                  title="Interrupt and stop speaking"
                >
                  <Square size={10} fill="currentColor" /> STOP SPEAKING
                </button>
              )}

              {/* Status label below atom */}
              <motion.div
                animate={isVisible ? { opacity: [0.6, 1, 0.6] } : false}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{
                  position: 'absolute',
                  bottom: 20,
                  fontFamily: 'Orbitron, sans-serif',
