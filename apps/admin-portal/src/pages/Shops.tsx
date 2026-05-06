import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getShops, createShop } from '../api/client'
import Badge from '../components/Badge'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

const CATEGORIES = ['grocery','pharmacy','electronics','bakery','restaurant','dairy','hardware','stationary','other']

// ── Map picker HTML (iframe) ──────────────────────────────────────────────────
function buildPickerHTML(initLat: number, initLng: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#1a1a1a}
  .leaflet-control-attribution{display:none}
  #coords{
    position:fixed;bottom:0;left:0;right:0;
    background:rgba(10,10,10,0.92);
    border-top:1px solid #2a2a2a;
    padding:12px 16px;
    display:flex;align-items:center;justify-content:space-between;
    font-family:sans-serif;z-index:9999;
  }
  #coordText{color:#aaa;font-size:13px}
  #coordText b{color:#fff}
  #confirmBtn{
    padding:9px 20px;background:#22C55E;border:none;border-radius:8px;
    color:#000;font-weight:700;font-size:13px;cursor:pointer;
  }
  #hint{
    position:fixed;top:12px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.75);color:#aaa;font-size:12px;font-family:sans-serif;
    padding:6px 14px;border-radius:20px;pointer-events:none;z-index:9999;
  }
</style>
</head>
<body>
<div id="hint">Click on the map to place the shop pin</div>
<div id="map"></div>
<div id="coords">
  <span id="coordText">📍 <b id="latTxt">${initLat.toFixed(6)}</b>, <b id="lngTxt">${initLng.toFixed(6)}</b></span>
  <button id="confirmBtn" onclick="confirm()">Confirm Location</button>
</div>
<script>
  var lat = ${initLat}, lng = ${initLng};
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([lat,lng],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  var icon = L.divIcon({
    html:'<div style="background:#22C55E;border:3px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">🏪</div>',
    className:'',iconAnchor:[14,14]
  });
  var marker = L.marker([lat,lng],{icon:icon,draggable:true}).addTo(map);

  function updateCoords(lt, ln) {
    lat = +lt.toFixed(6); lng = +ln.toFixed(6);
    document.getElementById('latTxt').textContent = lat;
    document.getElementById('lngTxt').textContent = lng;
    // hide hint after first interaction
    document.getElementById('hint').style.display = 'none';
  }

  marker.on('dragend', function(e){
    var p = marker.getLatLng();
    updateCoords(p.lat, p.lng);
  });

  map.on('click', function(e){
    marker.setLatLng(e.latlng);
    updateCoords(e.latlng.lat, e.latlng.lng);
  });

  function confirm() {
    var msg = JSON.stringify({type:'locationPicked', lat:lat, lng:lng});
    if (window.parent !== window) window.parent.postMessage(msg, '*');
    window.postMessage(msg, '*');
  }
</script>
</body>
</html>`
}

// ── Location Picker Modal ─────────────────────────────────────────────────────
function LocationPicker({ initLat, initLng, onPick, onClose }: {
  initLat: number; initLng: number;
  onPick: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const html = buildPickerHTML(initLat, initLng)

  useEffect(() => {
    function handler(e: MessageEvent) {
      try {
        const d = JSON.parse(typeof e.data === 'string' ? e.data : JSON.stringify(e.data))
        if (d.type === 'locationPicked') onPick(d.lat, d.lng)
      } catch {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onPick])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', flexDirection:'column' }}>
      {/* Top bar */}
      <div style={{ background:'#111', borderBottom:'1px solid #2a2a2a', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>📍 Locate Shop on Map</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ flex:1, border:'none', width:'100%' }}
        sandbox="allow-scripts allow-same-origin"
        title="Location Picker"
      />
    </div>
  )
}

export default function Shops() {
  const navigate = useNavigate()
  const [shops,   setShops]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [search,  setSearch]  = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', category:'grocery', address:'', phone:'', lat:'', lng:'', username:'', password:'' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  function loadShops() {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: '20' }
    if (search) params.search = search
    getShops(params).then(r => {
      setShops(r.data.shops)
      setTotal(r.data.total)
      setPages(r.data.pages || 1)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadShops() }, [search, page])

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    if (!form.name || !form.category || !form.address) {
      setCreateError('Name, category, and address are required'); return
    }
    if (!form.lat || !form.lng) {
      setCreateError('Please locate the shop on the map'); return
    }
    if (!form.username || form.username.length < 3) {
      setCreateError('Username must be at least 3 characters'); return
    }
    if (!form.password || form.password.length < 6) {
      setCreateError('Password must be at least 6 characters'); return
    }
    setCreating(true)
    try {
      await createShop({
        name:     form.name.trim(),
        category: form.category,
        address:  form.address.trim(),
        phone:    form.phone.trim() || null,
        lat:      form.lat   ? parseFloat(form.lat)   : null,
        lng:      form.lng   ? parseFloat(form.lng)   : null,
        username: form.username.trim().toLowerCase(),
        password: form.password,
      })
      setShowModal(false)
      setForm({ name:'', category:'grocery', address:'', phone:'', lat:'', lng:'', username:'', password:'' })
      loadShops()
    } catch (err: any) {
      setCreateError(err?.response?.data?.error ?? 'Failed to create shop')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Shops</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{total} registered shops</p>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Add Shop</button>
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
                {['Shop Name','Category','Phone','Address','Status','Orders','Revenue','Avg Order'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {shops.map(s => (
                  <tr key={s.id} style={{ borderBottom:'1px solid #1a1a1a', cursor:'pointer' }}
                    onClick={() => navigate(`/shops/${s.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={td}><span style={{ color:'#fff', fontWeight:700 }}>{s.name}</span></td>
                    <td style={{ ...td, textTransform:'capitalize' }}>{s.category}</td>
                    <td style={td}>{s.phone ?? '—'}</td>
                    <td style={{ ...td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' }}>{s.address ?? '—'}</td>
                    <td style={td}><Badge status={s.is_active ? 'active' : 'inactive'} /></td>
                    <td style={{ ...td, color:'#22C55E', fontWeight:700 }}>{Number(s.total_orders)}</td>
                    <td style={{ ...td, fontWeight:700 }}>{fmt(s.total_revenue)}</td>
                    <td style={{ ...td, color:'#FBBF24' }}>{fmt(s.avg_order_value)}</td>
                  </tr>
                ))}
                {shops.length === 0 && (
                  <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'#444', padding:40 }}>No shops found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:20 }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={pageBtn}>← Prev</button>
          <span style={{ color:'#555', fontSize:13 }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page===pages} style={pageBtn}>Next →</button>
        </div>
      )}

      {/* ── Location Picker (full-screen, over modal) ── */}
      {showPicker && (
        <LocationPicker
          initLat={form.lat ? parseFloat(form.lat) : 12.9352}
          initLng={form.lng ? parseFloat(form.lng) : 77.6245}
          onPick={(lat, lng) => {
            setF('lat', String(lat))
            setF('lng', String(lng))
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* ── Add Shop Modal ── */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fff' }}>Add New Shop</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={section}>
                <div style={sectionLabel}>Shop Details</div>
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Shop Name *</label>
                    <input style={inp} placeholder="Raju General Store" value={form.name} onChange={e => setF('name', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Category *</label>
                    <select style={inp} value={form.category} onChange={e => setF('category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Address *</label>
                  <input style={inp} placeholder="12, MG Road, Bengaluru" value={form.address} onChange={e => setF('address', e.target.value)} />
                </div>
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Phone</label>
                    <input style={inp} placeholder="+91 98765 43210" value={form.phone} onChange={e => setF('phone', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Location</label>
                    <button type="button" onClick={() => setShowPicker(true)} style={{
                      ...inp, cursor:'pointer', display:'flex', alignItems:'center', gap:8,
                      color: form.lat ? '#22C55E' : '#555', justifyContent:'flex-start',
                      background:'#161616', border: form.lat ? '1px solid #22C55E44' : '1px solid #2a2a2a',
                    }}>
                      <span style={{ fontSize:15 }}>📍</span>
                      <span style={{ fontSize:12 }}>
                        {form.lat && form.lng
                          ? `${parseFloat(form.lat).toFixed(5)}, ${parseFloat(form.lng).toFixed(5)}`
                          : 'Locate on Map'}
                      </span>
                      {form.lat && <span style={{ fontSize:11, color:'#555', marginLeft:'auto' }}>Change</span>}
                    </button>
                  </div>
                </div>
              </div>

              <div style={section}>
                <div style={sectionLabel}>Shop Owner Login Credentials</div>
                <p style={{ fontSize:12, color:'#555', marginBottom:12 }}>
                  Share these with the shop owner. They'll use them to log into the Shop Portal.
                </p>
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Username *</label>
                    <input style={inp} placeholder="raju_store" value={form.username} onChange={e => setF('username', e.target.value)} autoCapitalize="none" />
                  </div>
                  <div>
                    <label style={lbl}>Password *</label>
                    <div style={{ position:'relative' }}>
                      <input style={{ ...inp, paddingRight:36 }} type={showPw ? 'text' : 'password'}
                        placeholder="Min 6 characters" value={form.password} onChange={e => setF('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPw(v=>!v)}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:14 }}>
                        {showPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {createError && (
                <div style={{ color:'#EF4444', fontSize:13, padding:'10px 12px', background:'#1a0a0a', borderRadius:8, marginBottom:16, border:'1px solid #3a1515' }}>
                  {createError}
                </div>
              )}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={creating} style={primaryBtn}>{creating ? 'Creating…' : 'Create Shop'}</button>
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
const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }
const modal: React.CSSProperties = { background:'#111', border:'1px solid #2a2a2a', borderRadius:16, padding:28, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto' }
const section: React.CSSProperties = { background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:10, padding:16, marginBottom:16 }
const sectionLabel: React.CSSProperties = { fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }
const grid2: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }
const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, color:'#666', marginBottom:5 }
const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }
