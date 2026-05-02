import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

interface Order {
  id: string; status: string; total_amount: string; created_at: string
}

type Range = 'today' | 'week' | 'month' | 'all' | 'custom'

const QUICK: { key: Range; label: string; desc: string }[] = [
  { key: 'today', label: 'Today',      desc: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
  { key: 'week',  label: 'This Week',  desc: 'Mon – Sun' },
  { key: 'month', label: 'This Month', desc: new Date().toLocaleDateString('en-IN', { month: 'long' }) },
  { key: 'all',   label: 'All Time',   desc: 'Every order' },
]

const STATUS_META: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'all',       label: 'All',            color: '#374151', bg: '#F3F4F6' },
  { key: 'pending',   label: 'Pending',         color: '#D97706', bg: '#FFFBEB' },
  { key: 'confirmed', label: 'Confirmed',        color: '#2563EB', bg: '#EFF6FF' },
  { key: 'assigned',  label: 'Rider Assigned',   color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'picked_up', label: 'Picked Up',        color: '#EA580C', bg: '#FFF7ED' },
  { key: 'delivered', label: 'Delivered',        color: '#16A34A', bg: '#F0FDF4' },
  { key: 'cancelled', label: 'Cancelled',        color: '#DC2626', bg: '#FEF2F2' },
]

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function inRange(dateStr: string, range: Range, from: string, to: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return true // unparseable date — don't hide it
  const now = new Date()
  if (range === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end   = new Date(now); end.setHours(23, 59, 59, 999)
    return d >= start && d <= end
  }
  if (range === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0,0,0,0); return d >= s
  }
  if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (range === 'custom' && from && to) {
    const s = new Date(from); s.setHours(0,0,0,0)
    const e = new Date(to);   e.setHours(23,59,59,999)
    return d >= s && d <= e
  }
  return true
}

function activeLabel(range: Range, from: string, to: string) {
  if (range !== 'custom') return QUICK.find(r => r.key === range)?.label ?? ''
  const f = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  return from && to ? (from === to ? f(from) : `${f(from)} – ${f(to)}`) : 'Custom'
}

// ── Date Range Dropdown ──────────────────────────────────────────────
function DateRangePicker({ range, from, to, onChange }: {
  range: Range
  from: string
  to: string
  onChange: (r: Range, f: string, t: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo]     = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = activeLabel(range, from, to)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 10,
          border: '1.5px solid var(--gray-200)',
          background: open ? 'var(--green-600)' : 'white',
          color: open ? 'white' : 'var(--gray-700)',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
          boxShadow: 'var(--shadow)', transition: 'all 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'white', borderRadius: 14,
          border: '1.5px solid var(--gray-200)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          zIndex: 100, minWidth: 300, overflow: 'hidden',
        }}>
          {/* Quick options */}
          <div style={{ padding: '8px 6px' }}>
            {QUICK.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => { onChange(key, from, to); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: range === key ? 'var(--green-50)' : 'transparent',
                  fontFamily: 'inherit', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (range !== key) e.currentTarget.style.background = 'var(--gray-50)' }}
                onMouseLeave={e => { e.currentTarget.style.background = range === key ? 'var(--green-50)' : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {range === key
                    ? <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--green-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--gray-300)' }} />
                  }
                  <span style={{ fontSize: 14, fontWeight: 600, color: range === key ? 'var(--green-700)' : 'var(--gray-700)' }}>
                    {label}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{desc}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 6px' }} />

          {/* Custom date range */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Custom Range
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4 }}>FROM</div>
                <input
                  type="date"
                  value={localFrom}
                  max={localTo || toDateStr(new Date())}
                  onChange={e => setLocalFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1.5px solid var(--gray-200)',
                    borderRadius: 8, fontSize: 13, fontWeight: 500, outline: 'none',
                    fontFamily: 'inherit', color: 'var(--gray-700)', background: 'var(--gray-50)',
                    cursor: 'pointer',
                  }}
                />
              </div>
              <div style={{ color: 'var(--gray-300)', fontSize: 18, marginTop: 16 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4 }}>TO</div>
                <input
                  type="date"
                  value={localTo}
                  min={localFrom}
                  max={toDateStr(new Date())}
                  onChange={e => setLocalTo(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1.5px solid var(--gray-200)',
                    borderRadius: 8, fontSize: 13, fontWeight: 500, outline: 'none',
                    fontFamily: 'inherit', color: 'var(--gray-700)', background: 'var(--gray-50)',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
            <button
              onClick={() => { if (localFrom && localTo) { onChange('custom', localFrom, localTo); setOpen(false) } }}
              disabled={!localFrom || !localTo}
              style={{
                width: '100%', padding: '9px', borderRadius: 9, border: 'none',
                background: 'var(--green-600)', color: 'white',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', opacity: (!localFrom || !localTo) ? 0.4 : 1,
              }}
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: string
}) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -8, right: -8, fontSize: 56, opacity: 0.06, pointerEvents: 'none', lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{sub}</div>}
    </div>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { shop } = useAuth()
  const navigate  = useNavigate()
  const [allOrders, setAllOrders]   = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [range, setRange]           = useState<Range>('today')
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()))
  const [customTo,   setCustomTo]   = useState(toDateStr(new Date()))
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (!shop) return
    if (showSpinner) setLoading(true)
    try {
      const res = await api.get(`/shops/${shop.id}/orders`)
      setAllOrders(res.data.orders ?? [])
    } catch (e) { console.error(e) }
    finally { if (showSpinner) setLoading(false) }
  }, [shop])

  // Wrap initial call to show spinner only on first load
  const fetchOrdersInitial = useCallback(() => fetchOrders(true), [fetchOrders])

  useEffect(() => {
    fetchOrdersInitial()
    const timer = window.setInterval(fetchOrders, 8000)
    return () => clearInterval(timer)
  }, [fetchOrders, fetchOrdersInitial])

  const rangeOrders  = allOrders.filter(o => inRange(o.created_at, range, customFrom, customTo))
  const filtered     = statusFilter === 'all' ? rangeOrders : rangeOrders.filter(o => o.status === statusFilter)
  const revenue      = rangeOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total_amount), 0)
  const pendingCount = allOrders.filter(o => o.status === 'pending').length
  const activeCount  = allOrders.filter(o => ['confirmed','assigned','picked_up'].includes(o.status)).length

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const handleRangeChange = (r: Range, f: string, t: string) => {
    setRange(r); setCustomFrom(f); setCustomTo(t); setStatusFilter('all')
  }

  if (loading && allOrders.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <DateRangePicker
          range={range} from={customFrom} to={customTo}
          onChange={handleRangeChange}
        />
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon="📦" label="Orders"      value={String(rangeOrders.length)} sub={activeLabel(range, customFrom, customTo)}         accent="var(--green-600)" />
        <StatCard icon="💰" label="Revenue"     value={fmt(revenue)}               sub="Delivered orders only"                            accent="var(--green-700)" />
        <StatCard icon="🔔" label="Pending"     value={String(pendingCount)}       sub={pendingCount ? 'Needs confirmation' : 'All clear'} accent={pendingCount ? 'var(--yellow)' : 'var(--gray-400)'} />
        <StatCard icon="🛵" label="In Progress" value={String(activeCount)}        sub="Active right now"                                 accent="var(--blue)" />
      </div>

      {/* ── Pending alert ── */}
      {pendingCount > 0 && (
        <div style={{
          background: 'var(--yellow-light)', border: '1.5px solid #fde68a',
          borderRadius: 'var(--radius)', padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{pendingCount} new order{pendingCount !== 1 ? 's' : ''} waiting</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Confirm quickly to keep customers happy</div>
            </div>
          </div>
          <button className="btn-primary" onClick={() => navigate('/orders')}>View Orders →</button>
        </div>
      )}

      {/* ── Orders table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15, marginRight: 4 }}>Orders</span>
          <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{filtered.length} of {rangeOrders.length}</span>

          <div style={{ marginLeft: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {STATUS_META.map(({ key, label, color, bg }) => {
              const count = key === 'all' ? rangeOrders.length : rangeOrders.filter(o => o.status === key).length
              const active = statusFilter === key
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                    background: active ? color : bg,
                    color:      active ? 'white' : color,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                    borderRadius: 999, padding: '0 5px',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4 }}>No orders found</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Try a different date range or status filter</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  {['Order ID', 'Total', 'Status', 'Date', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const meta = STATUS_META.find(s => s.key === o.status)
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-400)' }}>
                        {o.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: 700, fontSize: 14 }}>
                        {fmt(parseFloat(o.total_amount))}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: meta?.bg ?? 'var(--gray-100)',
                          color: meta?.color ?? 'var(--gray-500)',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta?.color ?? 'var(--gray-400)', display: 'inline-block' }} />
                          {meta?.label ?? o.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--gray-600)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--gray-400)', fontSize: 12 }}>
                        {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
