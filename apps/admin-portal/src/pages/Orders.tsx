import React, { useEffect, useState } from 'react'
import { getOrders, getOnlineRiders, assignOrderRider, BASE_URL } from '../api/client'
import Badge from '../components/Badge'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
}

const STATUSES = ['all','pending','confirmed','assigned','picked_up','delivered','cancelled']

export default function Orders() {
  const [orders,   setOrders]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [pages,    setPages]    = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [items,    setItems]    = useState<Record<string, any[]>>({})

  // Rider assignment
  const [onlineRiders,    setOnlineRiders]    = useState<any[]>([])
  const [ridersLoaded,    setRidersLoaded]    = useState(false)
  const [selectedRider,   setSelectedRider]   = useState<Record<string, string>>({})  // orderId → riderId
  const [assigning,       setAssigning]       = useState<string | null>(null)          // orderId being assigned
  const [assignResult,    setAssignResult]    = useState<Record<string, { ok: boolean; msg: string }>>({})

  const loadOnlineRiders = async () => {
    if (ridersLoaded) return
    try {
      const res = await getOnlineRiders()
      setOnlineRiders(res.data.riders ?? [])
      setRidersLoaded(true)
    } catch {
      setOnlineRiders([])
    }
  }

  const handleAssign = async (orderId: string) => {
    const riderId = selectedRider[orderId]
    if (!riderId) return
    setAssigning(orderId)
    setAssignResult(prev => ({ ...prev, [orderId]: { ok: false, msg: '' } }))
    try {
      await assignOrderRider(orderId, riderId)
      setAssignResult(prev => ({ ...prev, [orderId]: { ok: true, msg: '✓ Rider assigned' } }))
      // Refresh order list so the rider name shows
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, rider_name: onlineRiders.find(r => r.id === riderId)?.name ?? o.rider_name, status: 'assigned' }
          : o
      ))
    } catch (e: any) {
      setAssignResult(prev => ({ ...prev, [orderId]: { ok: false, msg: e?.response?.data?.error ?? 'Failed to assign' } }))
    } finally {
      setAssigning(null)
    }
  }

  // Filters — all empty by default so ALL orders load on first visit
  const [status, setStatus] = useState('all')
  const [from,   setFrom]   = useState('')
  const [to,     setTo]     = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [fromInput,   setFromInput]   = useState('')
  const [toInput,     setToInput]     = useState('')

  const limit = 20

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: String(limit) }
    if (status !== 'all') params.status = status
    if (from)   params.from   = from
    if (to)     params.to     = to
    if (search) params.search = search

    getOrders(params).then(r => {
      setOrders(r.data.orders)
      setTotal(r.data.total)
      setPages(r.data.pages || 1)
    }).finally(() => setLoading(false))
  }, [status, from, to, search, page])

  function applySearch() {
    setSearch(searchInput)
    setPage(1)
  }

  async function exportCSV() {
    const token = localStorage.getItem('zuqu_admin_token')
    const params = new URLSearchParams()
    if (from)              params.set('from',   from)
    if (to)                params.set('to',     to)
    if (status !== 'all')  params.set('status', status)
    const res = await fetch(`${BASE_URL}/admin/export/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = href; a.download = 'orders.csv'; a.click()
    URL.revokeObjectURL(href)
  }

  function toggleExpand(id: string, order: any) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    loadOnlineRiders()
    if (!items[id]) {
      setItems(prev => ({ ...prev, [id]: order._items || [] }))
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Orders</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{total.toLocaleString()} total orders</p>
        </div>
        <button onClick={exportCSV} style={{ padding:'8px 16px', background:'#22C55E', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={selectStyle}>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_',' ')}</option>)}
        </select>
        <input type="date" value={fromInput} onChange={e => { setFromInput(e.target.value); setFrom(e.target.value); setPage(1) }} style={inputStyle} />
        <input type="date" value={toInput}   onChange={e => { setToInput(e.target.value);   setTo(e.target.value);   setPage(1) }} style={inputStyle} />
        <div style={{ display:'flex', gap:6, flex:1, minWidth:200 }}>
          <input
            placeholder="Search order#, shop, phone..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            style={{ ...inputStyle, flex:1 }}
          />
          <button onClick={applySearch} style={btnStyle}>Search</button>
        </div>
        {(status !== 'all' || from || to || search) && (
          <button onClick={() => { setStatus('all'); setFrom(''); setTo(''); setFromInput(''); setToInput(''); setSearch(''); setSearchInput(''); setPage(1) }}
            style={{ ...btnStyle, background:'transparent', color:'#EF4444', border:'1px solid #EF444440' }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'#22C55E' }}>Loading...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Order #','Shop','Customer','Rider','Status','Total','Delivery Fee','Placed','Delivered'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <>
                    <tr key={o.id}
                      style={{ borderBottom:'1px solid #1a1a1a', cursor:'pointer' }}
                      onClick={() => toggleExpand(o.id, o)}>
                      <td style={td}><span style={{ color:'#22C55E', fontWeight:700 }}>#{o.order_number}</span></td>
                      <td style={td}>{o.shop_name ?? '—'}</td>
                      <td style={td}>
                        <div style={{ fontWeight:600 }}>{o.customer_phone ?? '—'}</div>
                        {o.customer_name && <div style={{ fontSize:11, color:'#555' }}>{o.customer_name}</div>}
                      </td>
                      <td style={td}>{o.rider_name ?? <span style={{ color:'#333' }}>—</span>}</td>
                      <td style={td}><Badge status={o.status} /></td>
                      <td style={td}><span style={{ fontWeight:700 }}>{fmt(o.total_amount)}</span></td>
                      <td style={td}>{fmt(o.delivery_fee)}</td>
                      <td style={{ ...td, color:'#666', fontSize:12 }}>{fmtDate(o.created_at)}</td>
                      <td style={{ ...td, color:'#666', fontSize:12 }}>{o.delivered_at ? fmtDate(o.delivered_at) : '—'}</td>
                    </tr>
                    {expanded === o.id && (
                      <tr key={`${o.id}-exp`} style={{ background:'#0d0d0d' }}>
                        <td colSpan={9} style={{ padding:'14px 20px' }}>
                          <div style={{ fontSize:12, color:'#555', marginBottom:10 }}>ORDER ID: {o.id}</div>

                          {/* Summary row */}
                          <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:16 }}>
                            <div>
                              <div style={{ color:'#555', fontSize:11, marginBottom:2 }}>SHOP</div>
                              <div style={{ color:'#ccc', fontWeight:600 }}>{o.shop_name}</div>
                            </div>
                            <div>
                              <div style={{ color:'#555', fontSize:11, marginBottom:2 }}>CUSTOMER</div>
                              <div style={{ color:'#ccc', fontWeight:600 }}>{o.customer_phone}</div>
                            </div>
                            <div>
                              <div style={{ color:'#555', fontSize:11, marginBottom:2 }}>RIDER</div>
                              <div style={{ color: o.rider_name ? '#ccc' : '#444', fontWeight:600 }}>
                                {o.rider_name || 'Not assigned'}
                              </div>
                            </div>
                            <div>
                              <div style={{ color:'#555', fontSize:11, marginBottom:2 }}>ORDER TOTAL</div>
                              <div style={{ color:'#22C55E', fontWeight:700 }}>{fmt(o.total_amount)}</div>
                            </div>
                            <div>
                              <div style={{ color:'#555', fontSize:11, marginBottom:2 }}>DELIVERY FEE</div>
                              <div style={{ color:'#FBBF24', fontWeight:700 }}>{fmt(o.delivery_fee)}</div>
                            </div>
                          </div>

                          {/* Assign rider panel — shown for assignable statuses */}
                          {['pending','confirmed','assigned'].includes(o.status) && (
                            <div style={{
                              display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                              padding:'10px 14px', background:'#161616', borderRadius:10,
                              border:'1px solid #2a2a2a',
                            }}>
                              <span style={{ fontSize:12, color:'#888', fontWeight:600, minWidth:90 }}>
                                🛵 Assign Rider
                              </span>
                              <select
                                value={selectedRider[o.id] ?? ''}
                                onChange={e => setSelectedRider(prev => ({ ...prev, [o.id]: e.target.value }))}
                                style={{ ...selectStyle, minWidth:200, fontSize:13 }}
                              >
                                <option value=''>
                                  {onlineRiders.length === 0 ? '— No riders online —' : '— Pick a rider —'}
                                </option>
                                {onlineRiders.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} · {r.phone} · {r.vehicle_type}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssign(o.id)}
                                disabled={!selectedRider[o.id] || assigning === o.id}
                                style={{
                                  padding:'7px 18px', borderRadius:8, border:'none', fontWeight:700, fontSize:13,
                                  background: selectedRider[o.id] && assigning !== o.id ? '#22C55E' : '#2a2a2a',
                                  color: selectedRider[o.id] && assigning !== o.id ? '#000' : '#555',
                                  cursor: selectedRider[o.id] && assigning !== o.id ? 'pointer' : 'not-allowed',
                                }}
                              >
                                {assigning === o.id ? 'Assigning…' : 'Assign'}
                              </button>
                              {assignResult[o.id]?.msg && (
                                <span style={{ fontSize:13, fontWeight:600, color: assignResult[o.id].ok ? '#22C55E' : '#EF4444' }}>
                                  {assignResult[o.id].msg}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={9} style={{ ...td, textAlign:'center', color:'#444', padding:40 }}>No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>← Prev</button>
          <span style={{ color:'#555', fontSize:13 }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pageBtn}>Next →</button>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, overflow:'hidden' }
const th: React.CSSProperties = { textAlign:'left', padding:'10px 14px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap', background:'#111' }
const td: React.CSSProperties = { padding:'12px 14px', fontSize:13, color:'#ccc', whiteSpace:'nowrap' }
const inputStyle: React.CSSProperties = { padding:'8px 12px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, outline:'none' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor:'pointer' }
const btnStyle: React.CSSProperties = { padding:'8px 16px', background:'#22C55E', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }
const pageBtn: React.CSSProperties = { padding:'7px 16px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }
