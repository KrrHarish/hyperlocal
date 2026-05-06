import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStats, getOrders } from '../api/client'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60)    return `${Math.floor(d)}s ago`
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function toISO(d: Date) { return d.toISOString().split('T')[0] }

const STATUS_ORDER  = ['pending','confirmed','assigned','picked_up','delivered','cancelled']
const STATUS_COLORS: Record<string, string> = {
  pending:'#FBBF24', confirmed:'#60A5FA', assigned:'#A78BFA',
  picked_up:'#FB923C', delivered:'#22C55E', cancelled:'#EF4444',
}

// ─── Period presets ───────────────────────────────────────────────────────────
type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',     label: 'Today'      },
  { key: 'yesterday', label: 'Yesterday'  },
  { key: 'week',      label: 'This Week'  },
  { key: 'month',     label: 'This Month' },
  { key: 'year',      label: 'This Year'  },
  { key: 'custom',    label: 'Custom'     },
]

function getPresetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  if (preset === 'today') {
    const d = toISO(now)
    return { from: d, to: d }
  }
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(now.getDate() - 1)
    const d = toISO(y)
    return { from: d, to: d }
  }
  if (preset === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return { from: toISO(start), to: toISO(now) }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toISO(start), to: toISO(now) }
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { from: toISO(start), to: toISO(now) }
  }
  return null // custom — caller sets manually
}

// ─── Mini revenue bar chart ───────────────────────────────────────────────────
function RevenueChart({ daily }: { daily: { date: string; revenue: number; orders: number }[] }) {
  if (!daily || daily.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 13 }}>
        No revenue data for this period
      </div>
    )
  }
  const max = Math.max(...daily.map(d => d.revenue), 1)
  const show = daily.slice(-30) // last 30 days

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 12 }}>
      {show.map((d, i) => {
        const h = Math.max((d.revenue / max) * 72, d.revenue > 0 ? 4 : 1)
        const label = new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}
            title={`${label}\n${fmt(d.revenue)} · ${d.orders} orders`}>
            <div style={{
              width: '100%', height: h,
              background: '#22C55E',
              borderRadius: '3px 3px 0 0',
              opacity: d.revenue > 0 ? 0.85 : 0.15,
              transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = d.revenue > 0 ? '0.85' : '0.15')}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [preset,     setPreset]     = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const [stats,   setStats]   = useState<any>({
    total_orders: 0, total_revenue: 0, revenue_today: 0,
    active_riders: 0, total_riders: 0, total_shops: 0, total_customers: 0,
    orders_by_status: {}, daily_revenue: [],
  })
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Compute active from/to
  const activeRange = preset === 'custom'
    ? (customFrom && customTo ? { from: customFrom, to: customTo } : null)
    : getPresetRange(preset)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (activeRange) { params.from = activeRange.from; params.to = activeRange.to }

    const orderParams: Record<string, string> = { limit: '10' }
    if (activeRange) { orderParams.from = activeRange.from; orderParams.to = activeRange.to }

    await Promise.all([
      getStats(params).then(r => setStats(r.data)),
      getOrders(orderParams).then(r => setOrders(r.data.orders)),
    ]).catch(() => {})
    setLoading(false)
  }, [preset, customFrom, customTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  function applyCustom() {
    if (customFrom && customTo) {
      setShowCustom(false)
      // fetchAll triggered via effect since customFrom/To changed
    }
  }

  const rangeLabel = activeRange
    ? `${new Date(activeRange.from).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} – ${new Date(activeRange.to).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`
    : 'All time'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Dashboard</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 3 }}>
            {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            {activeRange && <span style={{ color: '#22C55E', marginLeft: 8, fontWeight: 600 }}>· {rangeLabel}</span>}
          </p>
        </div>

        {/* Period filter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => {
                  setPreset(p.key)
                  if (p.key === 'custom') setShowCustom(true)
                  else setShowCustom(false)
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  border: '1px solid',
                  borderColor: preset === p.key ? '#22C55E' : '#2a2a2a',
                  background: preset === p.key ? '#0d2a18' : '#161616',
                  color: preset === p.key ? '#22C55E' : '#666',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {showCustom && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10, padding: '8px 12px' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={dateInput} max={customTo || undefined} />
              <span style={{ color: '#444' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={dateInput} min={customFrom || undefined}
                max={toISO(new Date())} />
              <button onClick={applyCustom}
                disabled={!customFrom || !customTo}
                style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: customFrom && customTo ? '#22C55E' : '#1a3a25', color: customFrom && customTo ? '#000' : '#4ade8080', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? <Spinner /> : <>

        {/* Stat cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <StatCard label={preset === 'today' ? "Today's Orders" : "Orders"}
            value={stats.total_orders.toLocaleString()} icon="🧾" />
          <StatCard label="Revenue"
            value={fmt(stats.total_revenue)} icon="💰" />
          <StatCard label="Delivered"
            value={stats.orders_by_status?.delivered ?? 0} icon="✅" accent="#22C55E" />
          <StatCard label="Cancelled"
            value={stats.orders_by_status?.cancelled ?? 0} icon="❌" accent="#EF4444" />
          <StatCard label="Active Riders"
            value={`${stats.active_riders} / ${stats.total_riders}`} icon="🛵" accent="#A78BFA" />
          <StatCard label="Shops"
            value={stats.total_shops} icon="🏪" accent="#FB923C" />
          <StatCard label="Customers"
            value={stats.total_customers.toLocaleString()} icon="👥" accent="#60A5FA" />
          <StatCard label="Today's Revenue"
            value={fmt(stats.revenue_today)} icon="📈" accent="#FBBF24" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>

          {/* Revenue trend */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={sectionTitle}>Revenue Trend</h2>
              <span style={{ fontSize: 12, color: '#444' }}>{stats.daily_revenue?.length ?? 0} days</span>
            </div>
            <p style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>Hover bars for details</p>
            <RevenueChart daily={stats.daily_revenue ?? []} />
            {stats.daily_revenue?.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#333' }}>
                  {new Date(stats.daily_revenue[0].date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                </span>
                <span style={{ color: '#22C55E', fontWeight: 700 }}>{fmt(stats.total_revenue)} total</span>
                <span style={{ color: '#333' }}>
                  {new Date(stats.daily_revenue[stats.daily_revenue.length - 1].date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                </span>
              </div>
            )}
          </div>

          {/* Orders by status */}
          <div style={card}>
            <h2 style={{ ...sectionTitle, marginBottom: 16 }}>Orders by Status</h2>
            {(() => {
              const total = STATUS_ORDER.reduce((s, k) => s + (stats.orders_by_status[k] ?? 0), 0) || 1
              return STATUS_ORDER.map(s => {
                const count = stats.orders_by_status[s] ?? 0
                const pct   = Math.round((count / total) * 100)
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 82 }}><Badge status={s} /></div>
                    <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLORS[s], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 700, color: STATUS_COLORS[s] }}>{count}</div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* Recent orders */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={sectionTitle}>Recent Orders</h2>
              <p style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{rangeLabel}</p>
            </div>
            <button onClick={() => navigate('/orders')} style={linkBtn}>View all →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order #','Shop','Customer','Rider','Status','Amount','Time'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
                    onClick={() => navigate('/orders')}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={td}><span style={{ color: '#22C55E', fontWeight: 700 }}>#{o.order_number}</span></td>
                    <td style={td}>{o.shop_name ?? '—'}</td>
                    <td style={td}>
                      <div>{o.customer_phone ?? '—'}</div>
                      {o.customer_name && <div style={{ fontSize: 11, color: '#444' }}>{o.customer_name}</div>}
                    </td>
                    <td style={td}>{o.rider_name ?? <span style={{ color: '#333' }}>—</span>}</td>
                    <td style={td}><Badge status={o.status} /></td>
                    <td style={td}><span style={{ fontWeight: 700 }}>{fmt(o.total_amount)}</span></td>
                    <td style={{ ...td, color: '#555', fontSize: 12 }}>{timeAgo(o.created_at)}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#333', padding: 36 }}>
                    No orders in this period
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </>}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', fontSize: 14, fontWeight: 600 }}>
      Loading...
    </div>
  )
}

const card:         React.CSSProperties = { background: '#161616', border: '1px solid #222', borderRadius: 14, padding: '20px 22px' }
const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#fff' }
const th:           React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #222', whiteSpace: 'nowrap', background: '#111' }
const td:           React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: '#ccc', whiteSpace: 'nowrap' }
const linkBtn:      React.CSSProperties = { background: 'none', border: 'none', color: '#22C55E', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const dateInput:    React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12, outline: 'none', colorScheme: 'dark' }
