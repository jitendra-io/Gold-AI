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
