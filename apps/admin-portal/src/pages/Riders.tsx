import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRiders, createRider, BASE_URL } from '../api/client'
import Badge from '../components/Badge'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

export default function Riders() {
  const navigate = useNavigate()
  const [riders,  setRiders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [search,  setSearch]  = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', phone:'', vehicle_type:'bike' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  function loadRiders() {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: '20' }
    if (search) params.search = search
    getRiders(params).then(r => {
      setRiders(r.data.riders)
      setTotal(r.data.total)
      setPages(r.data.pages || 1)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadRiders() }, [search, page])

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    if (!form.name.trim()) { setCreateError('Name is required'); return }
    const cleaned = form.phone.replace(/\D/g, '').replace(/^91/, '')
    if (cleaned.length !== 10) { setCreateError('Enter a valid 10-digit phone number'); return }

    setCreating(true)
    try {
      await createRider({
        name:         form.name.trim(),
        phone:        `+91${cleaned}`,
        vehicle_type: form.vehicle_type,
      })
      setShowModal(false)
      setForm({ name:'', phone:'', vehicle_type:'bike' })
      loadRiders()
    } catch (err: any) {
      setCreateError(err?.response?.data?.error ?? 'Failed to add rider')
    } finally {
      setCreating(false)
    }
  }

  async function exportCSV() {
    const token = localStorage.getItem('zuqu_admin_token')
    const res = await fetch(`${BASE_URL}/admin/export/riders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = href; a.download = 'riders.csv'; a.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Riders</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{total} registered riders</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={exportCSV} style={ghostBtn}>⬇ Export CSV</button>
          <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Add Rider</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <input placeholder="Search by name or phone..." value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
          style={inputStyle} />
        <button onClick={() => { setSearch(searchInput); setPage(1) }} style={primaryBtn}>Search</button>
        {search && <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
          style={{ ...primaryBtn, background:'transparent', color:'#EF4444', border:'1px solid #EF444440' }}>Clear</button>}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'#22C55E' }}>Loading...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Name','Phone','Vehicle','Status','Verified','Deliveries','Total Earned','Avg / Delivery','Wallet','Trust'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {riders.map(r => {
                  const avg = r.total_deliveries > 0
                    ? Number(r.total_earned) / Number(r.total_deliveries) : 0
                  return (
                    <tr key={r.id} style={{ borderBottom:'1px solid #1a1a1a', cursor:'pointer' }}
                      onClick={() => navigate(`/riders/${r.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={td}><span style={{ color:'#fff', fontWeight:700 }}>{r.name}</span></td>
                      <td style={td}>{r.phone}</td>
                      <td style={{ ...td, textTransform:'capitalize' }}>{r.vehicle_type}</td>
                      <td style={td}><Badge status={r.is_online ? 'online' : 'offline'} /></td>
                      <td style={td}>
                        {r.is_suspended
                          ? <Badge status="suspended" />
                          : <Badge status={r.is_verified ? 'verified' : 'inactive'} />}
                      </td>
                      <td style={{ ...td, color:'#22C55E', fontWeight:700 }}>{Number(r.total_deliveries)}</td>
                      <td style={{ ...td, fontWeight:700 }}>{fmt(r.total_earned)}</td>
                      <td style={{ ...td, color:'#FBBF24' }}>{fmt(avg)}</td>
                      <td style={{ ...td, color:'#A78BFA' }}>{fmt(r.wallet_balance ?? 0)}</td>
                      <td style={{ ...td, color:'#60A5FA' }}>{r.trust_score ?? 100}</td>
                    </tr>
                  )
                })}
                {riders.length === 0 && (
                  <tr><td colSpan={10} style={{ ...td, textAlign:'center', color:'#444', padding:40 }}>No riders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:20 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={pageBtn}>← Prev</button>
          <span style={{ color:'#555', fontSize:13 }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages} style={pageBtn}>Next →</button>
        </div>
      )}

      {/* ── Add Rider Modal ── */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fff' }}>Add New Rider</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Full Name *</label>
                <input style={inp} placeholder="Raju Kumar" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Phone Number *</label>
                <div style={{ display:'flex', gap:0 }}>
                  <span style={{ padding:'8px 12px', background:'#0a0a0a', border:'1px solid #2a2a2a', borderRight:'none', borderRadius:'7px 0 0 7px', fontSize:13, color:'#555' }}>+91</span>
                  <input style={{ ...inp, borderRadius:'0 7px 7px 0', borderLeft:'none' }}
                    placeholder="98765 43210" value={form.phone}
                    onChange={e => setF('phone', e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Vehicle Type *</label>
                <select style={inp} value={form.vehicle_type} onChange={e => setF('vehicle_type', e.target.value)}>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="bicycle">Bicycle</option>
                  <option value="ev_bike">EV Bike</option>
                </select>
              </div>

              <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#555' }}>
                ℹ️ The rider will log in to the Rider App using their <strong style={{ color:'#aaa' }}>phone number</strong>. Rider is automatically verified and ready to accept orders.
              </div>

              {createError && (
                <div style={{ color:'#EF4444', fontSize:13, padding:'10px 12px', background:'#1a0a0a', borderRadius:8, marginBottom:16, border:'1px solid #3a1515' }}>
                  {createError}
                </div>
              )}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={creating} style={primaryBtn}>{creating ? 'Adding…' : 'Add Rider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, overflow:'hidden' }
const th: React.CSSProperties = { textAlign:'left', padding:'10px 14px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap', background:'#111' }
const td: React.CSSProperties = { padding:'12px 14px', fontSize:13, color:'#aaa', whiteSpace:'nowrap' }
const inputStyle: React.CSSProperties = { padding:'8px 12px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, outline:'none', minWidth:260 }
const primaryBtn: React.CSSProperties = { padding:'8px 16px', background:'#22C55E', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }
const ghostBtn: React.CSSProperties = { padding:'8px 16px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontWeight:600, fontSize:13, cursor:'pointer' }
const pageBtn: React.CSSProperties = { padding:'7px 16px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }
const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }
const modal: React.CSSProperties = { background:'#111', border:'1px solid #2a2a2a', borderRadius:16, padding:28, width:'100%', maxWidth:460 }
const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, color:'#666', marginBottom:5 }
const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }
