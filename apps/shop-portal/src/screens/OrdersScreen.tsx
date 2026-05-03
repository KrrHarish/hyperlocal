import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

type OrderStatus = 'pending' | 'confirmed' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled' | 'rejected'

interface OrderItem {
  id: string
  product_name: string
  product_brand: string
  product_unit: string
  quantity: number
  unit_price: string
  subtotal: string
}

interface Order {
  id: string
  order_number?: string
  status: OrderStatus
  total_amount: string
  subtotal: string
  delivery_fee: string
  delivery_address: { line1: string; city: string; pincode: string } | string
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

type Tab = 'pending' | 'active' | 'done'

const ACTIVE_STATUSES: OrderStatus[] = ['confirmed', 'assigned', 'picked_up']
const DONE_STATUSES:   OrderStatus[] = ['delivered', 'cancelled', 'rejected']

// ── Visual flow steps shown on each active order card
const FLOW_STEPS = [
  { status: 'confirmed', icon: '✅', label: 'Confirmed'      },
  { status: 'assigned',  icon: '🛵', label: 'Rider Assigned' },
  { status: 'picked_up', icon: '📦', label: 'Out for Delivery'},
  { status: 'delivered', icon: '🎉', label: 'Delivered'      },
]

const STATUS_LABEL: Record<string, string> = {
  pending:   '⏳ Pending',
  confirmed: '✅ Confirmed',
  assigned:  '🛵 Rider Assigned',
  picked_up: '📦 Out for Delivery',
  delivered: '🎉 Delivered',
  cancelled: '✗ Cancelled',
  rejected:  '✗ Rejected',
}

// Next action the shop owner can take for each status
const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: string; color?: string }>> = {
  pending:   { label: '✅ Confirm Order',        next: 'confirmed'  },
  confirmed: { label: '🛵 Out for Delivery',      next: 'picked_up'  },
  assigned:  { label: '📦 Rider Picked Up',       next: 'picked_up'  },
}

function fmt(n: string | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n))
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function AddressDisplay({ raw }: { raw: string | Record<string, string> }) {
  try {
    const addr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return <span>{addr.line1}, {addr.city} {addr.pincode}</span>
  } catch { return <span>{String(raw)}</span> }
}

const CANCEL_REASONS = [
  'Item out of stock',
  'Shop is closing early',
  'Cannot fulfill the order',
  'Item no longer available',
  'Other',
]

function CancelModal({ onConfirm, onClose }: { onConfirm: (r: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState('')
  const [custom, setCustom]     = useState('')
  const reason = selected === 'Other' ? custom : selected
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:14, padding:24, width:360, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Cancel Order</div>
        <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:16 }}>Please select a reason — the customer will see this.</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {CANCEL_REASONS.map(r => (
            <button key={r} onClick={() => setSelected(r)} style={{
              padding:'10px 14px', borderRadius:9, textAlign:'left', cursor:'pointer',
              border:`1.5px solid ${selected===r ? 'var(--red)' : 'var(--gray-200)'}`,
              background: selected===r ? 'var(--red-light)' : 'white',
              color: selected===r ? 'var(--red)' : 'var(--gray-700)',
              fontWeight:600, fontSize:13, fontFamily:'inherit', transition:'all 0.12s',
            }}>
              {selected===r ? '● ' : '○ '}{r}
            </button>
          ))}
        </div>
        {selected === 'Other' && (
          <textarea placeholder="Describe the reason…" value={custom} onChange={e => setCustom(e.target.value)} rows={2}
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, resize:'none', border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit', outline:'none', marginBottom:16 }} />
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-outline" onClick={onClose} style={{ flex:1 }}>Go Back</button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason}
            style={{ flex:2, padding:'10px', borderRadius:9, border:'none', cursor:'pointer', background: reason ? 'var(--red)' : 'var(--gray-200)', color:'white', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  )
}

function FlowTracker({ status }: { status: OrderStatus }) {
  const currentIdx = FLOW_STEPS.findIndex(s => s.status === status)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:16 }}>
      {FLOW_STEPS.map((step, i) => {
        const done    = i < currentIdx
        const current = i === currentIdx
        const future  = i > currentIdx
        return (
          <div key={step.status} style={{ display:'flex', alignItems:'center', flex: i < FLOW_STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14,
                background: done ? '#16A34A' : current ? '#FF8A00' : 'var(--gray-100)',
                color: (done || current) ? 'white' : 'var(--gray-400)',
                fontWeight:700,
                boxShadow: current ? '0 0 0 3px rgba(255,138,0,0.2)' : 'none',
                transition:'all 0.3s',
              }}>
                {done ? '✓' : step.icon}
              </div>
              <span style={{ fontSize:10, fontWeight:600, color: done ? '#16A34A' : current ? '#FF8A00' : 'var(--gray-400)', whiteSpace:'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? '#16A34A' : 'var(--gray-100)', margin:'0 4px', marginBottom:18, transition:'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function OrderCard({ order, onAction, onCancel }: {
  order: Order
  onAction: (id: string, status: string) => Promise<void>
  onCancel: (id: string, reason: string) => Promise<void>
}) {
  const [expanded, setExpanded]         = useState(order.status === 'pending')
  const [acting, setActing]             = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const action = NEXT_ACTION[order.status]
  const isActive = ACTIVE_STATUSES.includes(order.status)
  const isDone   = DONE_STATUSES.includes(order.status)

  const handleAction = async () => {
    if (!action) return
    setActing(true)
    try { await onAction(order.id, action.next) } finally { setActing(false) }
  }

  const handleCancel = async (reason: string) => {
    setShowCancelModal(false)
    setActing(true)
    try { await onCancel(order.id, reason) } finally { setActing(false) }
  }

  return (
    <>
      {showCancelModal && <CancelModal onConfirm={handleCancel} onClose={() => setShowCancelModal(false)} />}
      <div className="card" style={{ marginBottom:12, padding:0, overflow:'hidden', border: order.status === 'pending' ? '1.5px solid #F59E0B' : '1px solid var(--gray-100)' }}>

        {/* Header */}
        <div onClick={() => setExpanded(e => !e)} style={{
          padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer',
          background: order.status === 'pending' ? '#FFFBEB' : 'white',
          borderBottom: expanded ? '1px solid var(--gray-100)' : 'none',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'var(--gray-500)', background:'var(--gray-100)', padding:'3px 8px', borderRadius:6 }}>
              #{order.order_number || order.id.slice(0,8).toUpperCase()}
            </span>
            <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>{fmt(order.total_amount)}</span>
            <span style={{ color:'var(--gray-400)', fontSize:12 }}>{timeAgo(order.created_at)}</span>
            <span style={{ color:'var(--gray-400)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Body */}
        {expanded && (
          <div style={{ padding:'16px 18px' }}>

            {/* Flow tracker for active orders */}
            {isActive && <FlowTracker status={order.status} />}

            {/* Items */}
            {order.items && order.items.length > 0 ? (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>Items</div>
                {order.items.map(item => (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--gray-100)' }}>
                    <div>
                      <span style={{ fontWeight:600 }}>{item.product_name}</span>
                      {item.product_brand && <span style={{ color:'var(--gray-400)', fontSize:12 }}> · {item.product_brand}</span>}
                      {item.product_unit  && <span style={{ color:'var(--gray-400)', fontSize:12 }}> · {item.product_unit}</span>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:16 }}>
                      <span style={{ color:'var(--gray-400)', fontSize:12 }}>×{item.quantity}</span>
                      <span style={{ fontWeight:600, marginLeft:8 }}>{fmt(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0 0', fontSize:13, color:'var(--gray-500)' }}>
                  <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--gray-500)' }}>
                  <span>Delivery fee</span><span>{fmt(order.delivery_fee)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16, paddingTop:8, borderTop:'1.5px solid var(--gray-200)', marginTop:4 }}>
                  <span>Total</span><span>{fmt(order.total_amount)}</span>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom:14, color:'var(--gray-400)', fontSize:13 }}>Loading items…</div>
            )}

            {/* Address */}
            <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16, display:'flex', alignItems:'center', gap:4 }}>
              <span>📍</span><AddressDisplay raw={order.delivery_address as string} />
            </div>

            {/* Action buttons */}
            {!isDone && (
              <div style={{ display:'flex', gap:10 }}>
                {action && (
                  <button className="btn-primary" onClick={handleAction} disabled={acting}
                    style={{ padding:'10px 20px', fontSize:14, fontWeight:700 }}>
                    {acting ? 'Updating…' : action.label}
                  </button>
                )}
                {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'assigned') && (
                  <button className="btn-danger" onClick={() => setShowCancelModal(true)} disabled={acting}
                    style={{ padding:'10px 18px', fontSize:13 }}>
                    Cancel Order
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

type Toast = { msg: string; type: 'success' | 'error' }

export default function OrdersScreen() {
  const { shop } = useAuth()
  const [tab, setTab]       = useState<Tab>('pending')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]   = useState<Toast | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }

  const fetchOrders = useCallback(async () => {
    if (!shop) return
    try {
      const res = await api.get(`/shops/${shop.id}/orders`)
      const raw: Order[] = res.data.orders ?? []
      // Enrich active/pending orders with items
      const toEnrich = raw.filter(o => ['pending','confirmed','assigned','picked_up'].includes(o.status))
      const enriched = await Promise.all(toEnrich.map(async o => {
        try {
          const r = await api.get(`/orders/${o.id}`)
          return { ...o, items: r.data.order?.items ?? [] }
        } catch { return o }
      }))
      const enrichedMap = Object.fromEntries(enriched.map(o => [o.id, o]))
      setOrders(raw.map(o => enrichedMap[o.id] ?? o))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [shop])

  // Initial load
  useEffect(() => { fetchOrders() }, [fetchOrders])

  // WebSocket — real-time order updates (no polling)
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
          if ((event.type === 'order_created' || event.type === 'order_updated') && event.shopId === shop.id) {
            fetchOrders()
          }
        } catch {}
      }
      ws.onclose = () => { if (!destroyed) reconnectTimer = setTimeout(connect, 2000) }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [shop, fetchOrders])

  const handleAction = async (orderId: string, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status })
      await fetchOrders()
      const labels: Record<string, string> = {
        confirmed: '✅ Order confirmed!',
        picked_up: '📦 Out for delivery!',
        delivered: '🎉 Order delivered!',
      }
      showToast(labels[status] ?? 'Order updated', 'success')
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to update order', 'error')
    }
  }

  const handleCancel = async (orderId: string, reason: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'cancelled', reason })
      await fetchOrders()
      showToast('Order cancelled', 'success')
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to cancel order', 'error')
    }
  }

  const pending = orders.filter(o => o.status === 'pending')
  const active  = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const done    = orders.filter(o => DONE_STATUSES.includes(o.status))
  const tabOrders = tab === 'pending' ? pending : tab === 'active' ? active : done

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count: number }) => (
    <button onClick={() => setTab(id)} style={{
      padding:'8px 20px', borderRadius:8, fontSize:14, fontWeight:600, border:'none',
      background: tab === id ? 'var(--green-600)' : 'white',
      color: tab === id ? 'white' : 'var(--gray-500)',
      boxShadow: tab === id ? 'none' : 'var(--shadow)',
      display:'flex', alignItems:'center', gap:8, cursor:'pointer', transition:'all 0.15s',
    }}>
      {label}
      {count > 0 && (
        <span style={{
          background: tab === id ? 'rgba(255,255,255,0.25)' : (id === 'pending' ? '#F59E0B' : 'var(--gray-200)'),
          color: tab === id ? 'white' : (id === 'pending' ? 'white' : 'var(--gray-600)'),
          padding:'1px 7px', borderRadius:999, fontSize:12,
        }}>{count}</span>
      )}
    </button>
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  return (
    <div style={{ maxWidth:800 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'success' ? '#166534' : '#991B1B',
          color:'white', padding:'12px 22px', borderRadius:12, fontWeight:600, fontSize:14,
          zIndex:9999, boxShadow:'0 8px 24px rgba(0,0,0,0.2)', display:'flex', alignItems:'center', gap:8,
        }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>{toast.msg}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Orders</h1>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#16A34A', fontWeight:600 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#16A34A', display:'inline-block', boxShadow:'0 0 0 2px rgba(22,163,74,0.3)' }} />
          Live
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <TabBtn id="pending" label="Pending" count={pending.length} />
        <TabBtn id="active"  label="Active"  count={active.length}  />
        <TabBtn id="done"    label="Done"    count={done.length}    />
      </div>

      {tabOrders.length === 0 ? (
        <div className="card" style={{ textAlign:'center', color:'var(--gray-400)', padding:48 }}>
          {tab === 'pending' ? '🎉 No pending orders right now'
            : tab === 'active' ? 'No active orders'
            : 'No completed orders yet'}
        </div>
      ) : (
        tabOrders.map(o => (
          <OrderCard key={o.id} order={o} onAction={handleAction} onCancel={handleCancel} />
        ))
      )}
    </div>
  )
}
