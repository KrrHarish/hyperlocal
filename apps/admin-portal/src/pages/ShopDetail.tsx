import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getShop, suspendShop, updateShop, getShopCredentials, setShopCredentials, seedShopCatalogue, uploadShopImage } from '../api/client'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

const CATEGORIES = ['grocery','pharmacy','electronics','bakery','restaurant','dairy','hardware','stationary','other']

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Edit shop state
  const [showEdit, setShowEdit]   = useState(false)
  const [editForm, setEditForm]   = useState<any>({})
  const [saving,   setSaving]     = useState(false)
  const [editErr,  setEditErr]    = useState('')

  // Suspend state
  const [suspending,   setSuspending]   = useState(false)
  const [togglingOpen, setTogglingOpen] = useState(false)

  // Seed catalogue state
  const [seeding,    setSeeding]    = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)

  // Image upload state
  const [uploadingImg, setUploadingImg] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  // Credentials state
  const [showCreds,  setShowCreds]  = useState(false)
  const [credInfo,   setCredInfo]   = useState<{ username: string | null; is_active: boolean } | null>(null)
  const [credForm,   setCredForm]   = useState({ username:'', password:'' })
  const [showPw,     setShowPw]     = useState(false)
  const [savingCred, setSavingCred] = useState(false)
  const [credErr,    setCredErr]    = useState('')
  const [credOk,     setCredOk]     = useState('')

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    getShop(id).then(r => {
      setData(r.data)
      setEditForm({
        name:     r.data.shop.name,
        category: r.data.shop.category,
        address:  r.data.shop.address ?? '',
        phone:    r.data.shop.phone   ?? '',
        lat:      r.data.shop.lat     ?? '',
        lng:      r.data.shop.lng     ?? '',
      })
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  async function loadCreds() {
    if (!id) return
    try {
      const r = await getShopCredentials(id)
      setCredInfo(r.data)
      setCredForm({ username: r.data.username ?? '', password: '' })
    } catch {}
  }

  async function handleToggleOpen() {
    if (!id || !data) return
    setTogglingOpen(true)
    try {
      await updateShop(id, { is_open: !data.shop.is_open })
      load()
    } finally {
      setTogglingOpen(false)
    }
  }

  async function handleSuspend() {
    if (!id || !data) return
    const action = data.shop.is_active ? 'suspend' : 'activate'
    if (!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} this shop?`)) return
    setSuspending(true)
    try {
      await suspendShop(id)
      load()
    } finally {
      setSuspending(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setEditErr('')
    setSaving(true)
    try {
      await updateShop(id, {
        name:     editForm.name.trim(),
        category: editForm.category,
        address:  editForm.address.trim(),
        phone:    editForm.phone.trim() || null,
        lat:      editForm.lat ? parseFloat(editForm.lat) : null,
        lng:      editForm.lng ? parseFloat(editForm.lng) : null,
      })
      setShowEdit(false)
      load()
    } catch (err: any) {
      setEditErr(err?.response?.data?.error ?? 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveCreds(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setCredErr('')
    setCredOk('')
    if (!credForm.username || credForm.username.length < 3) {
      setCredErr('Username must be at least 3 characters'); return
    }
    if (!credForm.password || credForm.password.length < 6) {
      setCredErr('Password must be at least 6 characters'); return
    }
    setSavingCred(true)
    try {
      await setShopCredentials(id, credForm.username.trim().toLowerCase(), credForm.password)
      setCredOk(`✓ Credentials updated — username: ${credForm.username.trim().toLowerCase()}`)
      setCredForm(f => ({ ...f, password:'' }))
      await loadCreds()
    } catch (err: any) {
      setCredErr(err?.response?.data?.error ?? 'Failed to update credentials')
    } finally {
      setSavingCred(false)
    }
  }

  async function handleSeedCatalogue() {
    if (!id) return
    if (!confirm(`Seed the default "${data?.shop?.category}" catalogue into this shop? Existing products won't be removed — only new ones are added.`)) return
    setSeeding(true)
    setSeedResult(null)
    try {
      const r = await seedShopCatalogue(id)
      setSeedResult(`✓ Done — ${r.data.product_count} products now in catalogue`)
    } catch (err: any) {
      setSeedResult(`✗ ${err?.response?.data?.error ?? 'Failed to seed catalogue'}`)
    } finally {
      setSeeding(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingImg(true)
    try {
      await uploadShopImage(id, file)
      load() // reload to get updated image_url
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Image upload failed')
    } finally {
      setUploadingImg(false)
      if (imgInputRef.current) imgInputRef.current.value = ''
    }
  }

  function setEF(k: string, v: string) { setEditForm((f: any) => ({ ...f, [k]: v })) }
  function setCF(k: string, v: string) { setCredForm(f => ({ ...f, [k]: v })) }

  if (loading) return <div style={{ padding:48, textAlign:'center', color:'#22C55E' }}>Loading...</div>
  if (!data)   return <div style={{ padding:48, textAlign:'center', color:'#EF4444' }}>Shop not found</div>

  const { shop, revenue, recent_orders } = data

  return (
    <div style={{ padding:'28px 32px', maxWidth:1100 }}>
      <button onClick={() => navigate('/shops')} style={backBtn}>← Back to Shops</button>

      {/* Profile header */}
      <div style={{ ...card, marginBottom:20, display:'flex', flexWrap:'wrap', gap:24, alignItems:'flex-start' }}>
        {/* Clickable shop avatar — click to upload logo */}
        <div
          onClick={() => imgInputRef.current?.click()}
          title="Click to upload shop image"
          style={{ position:'relative', width:72, height:72, borderRadius:16, overflow:'hidden', flexShrink:0, cursor:'pointer', border:'2px solid #2a2a2a' }}
        >
          {shop.image_url ? (
            <img
              src={`http://localhost:3000${shop.image_url}`}
              alt={shop.name}
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
            />
          ) : (
            <div style={{ width:'100%', height:'100%', background:'#1a2a3a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}>
              🏪
            </div>
          )}
          {/* Hover overlay */}
          <div style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center',
            opacity: uploadingImg ? 1 : 0, transition:'opacity 0.15s',
            fontSize:11, color:'#fff', fontWeight:700, flexDirection:'column', gap:3,
          }}
            onMouseEnter={e => { if (!uploadingImg) (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
            onMouseLeave={e => { if (!uploadingImg) (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
          >
            {uploadingImg ? '⏳' : <>📷<span>Upload</span></>}
          </div>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload} />
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{shop.name}</div>
          <div style={{ color:'#555', fontSize:13, marginTop:2, textTransform:'capitalize' }}>{shop.category}</div>
          {shop.phone   && <div style={{ color:'#555', fontSize:13, marginTop:2 }}>{shop.phone}</div>}
          {shop.address && <div style={{ color:'#555', fontSize:13, marginTop:2 }}>{shop.address}</div>}
          {(shop.lat && shop.lng) && (
            <div style={{ color:'#333', fontSize:12, marginTop:2 }}>📍 {shop.lat}, {shop.lng}</div>
          )}
          <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
            <Badge status={shop.is_active ? 'active' : 'inactive'} />
            <Badge status={shop.is_open ? 'online' : 'offline'} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => setShowEdit(true)} style={secondaryBtn}>✏️ Edit</button>
          <button onClick={() => { setShowCreds(true); loadCreds() }} style={secondaryBtn}>🔑 Credentials</button>
          <button onClick={handleSeedCatalogue} disabled={seeding}
            style={{ ...secondaryBtn, color:'#A78BFA', borderColor:'#A78BFA40' }}>
            {seeding ? '⏳ Seeding…' : '📦 Seed Catalogue'}
          </button>
          <button onClick={handleToggleOpen} disabled={togglingOpen}
            style={{ ...secondaryBtn, color: shop.is_open ? '#F59E0B' : '#22C55E', borderColor: shop.is_open ? '#F59E0B40' : '#22C55E40' }}>
            {togglingOpen ? '…' : shop.is_open ? '🔒 Mark Closed' : '🟢 Open for Business'}
          </button>
          <button onClick={handleSuspend} disabled={suspending}
            style={{ ...secondaryBtn, color: shop.is_active ? '#EF4444' : '#22C55E', borderColor: shop.is_active ? '#EF444440' : '#22C55E40' }}>
            {suspending ? '…' : shop.is_active ? '⛔ Suspend' : '✅ Activate'}
          </button>
        </div>
        {seedResult && (
          <div style={{
            width: '100%', marginTop: 8, padding: '8px 14px', borderRadius: 8, fontSize: 13,
            color: seedResult.startsWith('✓') ? '#22C55E' : '#EF4444',
            background: seedResult.startsWith('✓') ? '#0a1a0a' : '#1a0a0a',
            border: `1px solid ${seedResult.startsWith('✓') ? '#1a3a1a' : '#3a1515'}`,
          }}>
            {seedResult}
          </div>
        )}
      </div>

      {/* Revenue stats */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <StatCard label="Total Orders"    value={revenue.total_orders}        icon="📦" />
        <StatCard label="Total Revenue"   value={fmt(revenue.total_revenue)}  icon="💰" />
        <StatCard label="Avg Order Value" value={fmt(revenue.avg_order_value)} icon="📈" accent="#FBBF24" />
      </div>

      {/* Recent orders */}
      <div style={card}>
        <h2 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Recent Orders</h2>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Order #','Customer','Rider','Status','Total','Delivery Fee','Placed At'].map(h =>
                <th key={h} style={th}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {recent_orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                  <td style={td}><span style={{ color:'#22C55E', fontWeight:700 }}>#{o.order_number}</span></td>
                  <td style={td}>{o.customer_phone ?? '—'}</td>
                  <td style={td}>{o.rider_name ?? <span style={{ color:'#333' }}>—</span>}</td>
                  <td style={td}><Badge status={o.status} /></td>
                  <td style={{ ...td, fontWeight:700 }}>{fmt(o.total_amount)}</td>
                  <td style={{ ...td, color:'#FBBF24' }}>{fmt(o.delivery_fee)}</td>
                  <td style={{ ...td, color:'#555', fontSize:12 }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
              {recent_orders.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'#444', padding:32 }}>No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Shop Modal ── */}
      {showEdit && (
        <div style={overlay} onClick={() => setShowEdit(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Edit Shop</h2>
              <button onClick={() => setShowEdit(false)} style={xBtn}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Shop Name</label>
                  <input style={inp} value={editForm.name} onChange={e => setEF('name', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={inp} value={editForm.category} onChange={e => setEF('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>Address</label>
                <input style={inp} value={editForm.address} onChange={e => setEF('address', e.target.value)} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>Phone</label>
                <input style={inp} value={editForm.phone} onChange={e => setEF('phone', e.target.value)} />
              </div>
              <div style={{ ...grid2, marginBottom:16 }}>
                <div>
                  <label style={lbl}>Latitude</label>
                  <input style={inp} value={editForm.lat} onChange={e => setEF('lat', e.target.value)} placeholder="12.9352" />
                </div>
                <div>
                  <label style={lbl}>Longitude</label>
                  <input style={inp} value={editForm.lng} onChange={e => setEF('lng', e.target.value)} placeholder="77.6245" />
                </div>
              </div>
              {editErr && <div style={errBox}>{editErr}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowEdit(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {showCreds && (
        <div style={overlay} onClick={() => setShowCreds(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Shop Portal Credentials</h2>
              <button onClick={() => setShowCreds(false)} style={xBtn}>✕</button>
            </div>

            {/* Current username info */}
            <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:10, padding:'12px 14px', marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Current Login</div>
              {credInfo?.username ? (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:'monospace', color:'#22C55E', fontWeight:700, fontSize:15 }}>{credInfo.username}</span>
                  <Badge status={credInfo.is_active ? 'active' : 'inactive'} />
                </div>
              ) : (
                <span style={{ color:'#555', fontSize:13 }}>No credentials set yet</span>
              )}
            </div>

            <form onSubmit={handleSaveCreds}>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>New Username</label>
                <input style={inp} value={credForm.username} onChange={e => setCF('username', e.target.value)}
                  placeholder="shop_username" autoCapitalize="none" />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>New Password</label>
                <div style={{ position:'relative' }}>
                  <input style={{ ...inp, paddingRight:36 }} type={showPw ? 'text' : 'password'}
                    value={credForm.password} onChange={e => setCF('password', e.target.value)}
                    placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPw(v=>!v)}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:14 }}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              {credErr && <div style={errBox}>{credErr}</div>}
              {credOk  && <div style={{ ...errBox, color:'#22C55E', background:'#0a1a0a', borderColor:'#1a3a1a' }}>{credOk}</div>}
              <div style={{ fontSize:12, color:'#444', marginBottom:16 }}>
                Share updated credentials with the shop owner. Password is stored securely (hashed).
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowCreds(false)} style={ghostBtn}>Close</button>
                <button type="submit" disabled={savingCred} style={primaryBtn}>
                  {savingCred ? 'Saving…' : credInfo?.username ? 'Update Credentials' : 'Set Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, padding:'20px 22px' }
const th: React.CSSProperties = { textAlign:'left', padding:'8px 12px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap' }
const td: React.CSSProperties = { padding:'11px 12px', fontSize:13, color:'#ccc', whiteSpace:'nowrap' }
const backBtn: React.CSSProperties = { background:'none', border:'none', color:'#555', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:20, padding:0 }
const secondaryBtn: React.CSSProperties = { padding:'7px 14px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontWeight:600, fontSize:13, cursor:'pointer' }
const primaryBtn: React.CSSProperties = { padding:'8px 16px', background:'#22C55E', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }
const ghostBtn: React.CSSProperties = { padding:'8px 16px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontWeight:600, fontSize:13, cursor:'pointer' }
const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }
const modal: React.CSSProperties = { background:'#111', border:'1px solid #2a2a2a', borderRadius:16, padding:28, width:'100%', maxWidth:480 }
const grid2: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }
const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, color:'#666', marginBottom:5 }
const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }
const errBox: React.CSSProperties = { color:'#EF4444', fontSize:13, padding:'10px 12px', background:'#1a0a0a', borderRadius:8, marginBottom:14, border:'1px solid #3a1515' }
const xBtn: React.CSSProperties = { background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer' }
