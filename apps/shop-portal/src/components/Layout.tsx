import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { api } from '../api/client'
import { useState, useEffect, useRef } from 'react'

// ── Global new-order chime ───────────────────────────────────────────
let _audioCtx: AudioContext | null = null
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}
function playChime() {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    // Hard limiter so it's loud but never clips
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -3
    comp.knee.value      = 1
    comp.ratio.value     = 20
    comp.attack.value    = 0.001
    comp.release.value   = 0.1
    comp.connect(ctx.destination)

    const master = ctx.createGain()
    master.gain.value = 3.0   // ← max volume
    master.connect(comp)

    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18

      // Fundamental
      const osc1 = ctx.createOscillator(), g1 = ctx.createGain()
      osc1.connect(g1); g1.connect(master)
      osc1.type = 'sine'; osc1.frequency.value = freq
      g1.gain.setValueAtTime(0, t)
      g1.gain.linearRampToValueAtTime(1.0, t + 0.01)
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      osc1.start(t); osc1.stop(t + 0.6)

      // 2nd harmonic for richness
      const osc2 = ctx.createOscillator(), g2 = ctx.createGain()
      osc2.connect(g2); g2.connect(master)
      osc2.type = 'sine'; osc2.frequency.value = freq * 2
      g2.gain.setValueAtTime(0, t)
      g2.gain.linearRampToValueAtTime(0.5, t + 0.01)
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc2.start(t); osc2.stop(t + 0.4)

      // 3rd harmonic for presence
      const osc3 = ctx.createOscillator(), g3 = ctx.createGain()
      osc3.connect(g3); g3.connect(master)
      osc3.type = 'triangle'; osc3.frequency.value = freq * 3
      g3.gain.setValueAtTime(0, t)
      g3.gain.linearRampToValueAtTime(0.25, t + 0.01)
      g3.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc3.start(t); osc3.stop(t + 0.25)
    })
  } catch {}
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const NAV = [
  { to: '/dashboard', icon: '◈', label: 'Dashboard' },
  { to: '/orders',    icon: '🔔', label: 'Orders'    },
  { to: '/catalogue', icon: '📦', label: 'Catalogue' },
]

// ── Browser notification helper ────────────────────────────────────
async function showOrderNotification(newOrders: any[]) {
  if (Notification.permission !== 'granted') return
  const count   = newOrders.length
  const preview = newOrders[0]?.preview || ''
  const total   = newOrders[0]?.total_amount ?? newOrders[0]?.total ?? ''
  const title   = count === 1 ? '🛒 New Order Received!' : `🛒 ${count} New Orders!`
  const lines   = [
    preview ? `📦 ${preview}` : '',
    total   ? `💰 ₹${parseFloat(total).toFixed(0)}` : '',
    `👆 Tap to open Orders`,
  ].filter(Boolean).join('\n')
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body: lines,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'new-order',
      requireInteraction: true,
      actions: [
        { action: 'view', title: '📋 View Orders' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    } as any)
  } catch {
    new Notification(title, { body: lines, icon: '/icon-192.png', tag: 'new-order' })
  }
}

export default function Layout() {
  const { shop, setShop, logout } = useAuth()
  const navigate = useNavigate()
  const [toggling, setToggling] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [soundEnabled, setSoundEnabled]   = useState(false)
  const [notifEnabled, setNotifEnabled]   = useState(() => Notification.permission === 'granted')
  const pushSubRef      = useRef<PushSubscription | null>(null)
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  // Real-time new-order alerts via WebSocket — no polling
  useEffect(() => {
    if (!shop) return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    const connect = () => {
      if (destroyed) return
      ws = new WebSocket('ws://localhost:3000/ws')

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'order_created' && event.shopId === shop.id) {
            if (soundEnabledRef.current) playChime()
            showOrderNotification([{ preview: event.preview, total_amount: event.total }])
          }
        } catch {}
      }

      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [shop])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const toggleOpen = async () => {
    if (!shop || toggling) return
    const next = !shop.is_open
    setToggling(true)
    try {
      const res = await api.patch(`/shops/${shop.id}/status`, {
        is_open: next,
        is_active: shop.is_active,
      })
      console.log('Toggle response:', res.data)
      if (res.data.shop) {
        setShop(res.data.shop)
        showToast(next ? 'Shop is now Open 🟢' : 'Shop is now Closed 🔴', true)
      }
    } catch (e: any) {
      console.error('Toggle failed:', e?.response?.data ?? e)
      showToast(e?.response?.data?.error ?? 'Failed to update status', false)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#14532d' : '#7f1d1d',
          color: 'white', padding: '12px 24px', borderRadius: 10,
          fontSize: 14, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: 'var(--green-900)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
            Zuqu
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Shop Portal
          </div>
        </div>

        {/* Shop info + Open/Close toggle */}
        {shop && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {shop.category}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 14 }}>
              {shop.name}
            </div>

            {/* Toggle switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: shop.is_open ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                  {toggling ? 'Updating…' : shop.is_open ? '● Open' : '○ Closed'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  {shop.is_open ? 'Accepting orders' : 'Not accepting orders'}
                </div>
              </div>
              <button
                onClick={toggleOpen}
                disabled={toggling}
                title={shop.is_open ? 'Click to close shop' : 'Click to open shop'}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  background: shop.is_open ? '#16a34a' : 'rgba(255,255,255,0.15)',
                  border: 'none',
                  cursor: toggling ? 'wait' : 'pointer',
                  position: 'relative',
                  transition: 'background 0.25s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: shop.is_open ? 'calc(100% - 21px)' : 3,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.25s',
                  display: 'block',
                }} />
              </button>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sound + Notification controls */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Sound toggle */}
          <button
            onClick={() => {
              try {
                getAudioCtx().resume().then(() => {
                  if (!soundEnabled) playChime()
                  setSoundEnabled(s => !s)
                })
              } catch {}
            }}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              background: soundEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
              border: soundEnabled ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: soundEnabled ? '#4ade80' : 'rgba(255,255,255,0.45)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            <span>{soundEnabled ? '🔔' : '🔕'}</span>
            {soundEnabled ? 'Sound On' : 'Enable Sound'}
          </button>

          {/* Browser notifications */}
          {Notification.permission !== 'denied' && (
            <button
              onClick={async () => {
                if (notifEnabled) {
                  // Unsubscribe
                  try {
                    if (pushSubRef.current) {
                      await api.delete(`/shops/${shop!.id}/push-subscription`, {
                        data: { endpoint: pushSubRef.current.endpoint }
                      })
                      await pushSubRef.current.unsubscribe()
                      pushSubRef.current = null
                    }
                  } catch {}
                  setNotifEnabled(false)
                  return
                }
                try {
                  const perm = await Notification.requestPermission()
                  if (perm !== 'granted') return

                  const reg = await navigator.serviceWorker.register('/sw.js')
                  await navigator.serviceWorker.ready

                  const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                  })
                  pushSubRef.current = sub
                  const key = sub.getKey('p256dh')
                  const auth = sub.getKey('auth')
                  await api.post(`/shops/${shop!.id}/push-subscription`, {
                    endpoint: sub.endpoint,
                    p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
                    auth:   auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
                  })
                  setNotifEnabled(true)
                  new Notification('🔔 Alerts enabled!', {
                    body: "You'll get push notifications for new orders even when this tab is closed.",
                    icon: '/icon-192.png',
                    tag: 'notif-test',
                  })
                } catch (e) {
                  console.error('Push setup failed:', e)
                }
              }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: notifEnabled ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.06)',
                border: notifEnabled ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.08)',
                color: notifEnabled ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <span>{notifEnabled ? '🖥️' : '🔕'}</span>
              {notifEnabled ? 'Alerts On' : 'Enable Alerts'}
            </button>
          )}

          {Notification.permission === 'denied' && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 11,
              color: 'rgba(255,255,255,0.3)', lineHeight: 1.5,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              🚫 Notifications blocked in browser settings
            </div>
          )}

        </div>

        {/* Logout */}
        <div style={{ padding: '16px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            <span>⎋</span> Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 56,
          background: 'white',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-700)' }}>
            {shop?.name ?? '—'}
          </div>
          {shop && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: shop.is_open ? 'var(--green-100)' : 'var(--gray-100)',
              fontSize: 12,
              fontWeight: 700,
              color: shop.is_open ? 'var(--green-700)' : 'var(--gray-500)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: shop.is_open ? 'var(--green-500)' : 'var(--gray-400)',
                display: 'inline-block',
              }} />
              {shop.is_open ? 'Open' : 'Closed'}
            </div>
          )}
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
