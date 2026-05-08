import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

// ── Inline Calendar Picker ────────────────────────────────────────────────────
function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]           = useState(false)
  const [viewYear, setViewYear]   = useState(() => value ? new Date(value).getFullYear() : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value).getMonth()    : new Date().getMonth())
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedDate = value ? value.slice(0, 10) : ''

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun

  const pickDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const dateStr = `${viewYear}-${mm}-${dd}`
    // keep existing time if any, otherwise default to 23:59
    const time = value ? value.slice(11, 16) || '23:59' : '23:59'
    onChange(`${dateStr}T${time}`)
    setOpen(false)
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

  const displayValue = value
    ? new Date(value).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : ''

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle,
          display:'flex', alignItems:'center', gap:10,
          cursor:'pointer', textAlign:'left', justifyContent:'space-between',
          color: displayValue ? '#fff' : '#444',
        }}
      >
        <span>{displayValue || 'Pick a date…'}</span>
        <span style={{ fontSize:15, color:'#555' }}>📅</span>
      </button>

      {/* Calendar popup */}
      {open && (
        <div style={{
          position:'absolute', zIndex:999, top:'calc(100% + 6px)', left:0,
          background:'#161616', border:'1px solid #2a2a2a', borderRadius:12,
          padding:16, width:280, boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
            <span style={{ fontWeight:700, fontSize:14, color:'#fff' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', marginBottom:6 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:10, color:'#555', fontWeight:700, padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
            {/* Empty cells for first-day offset */}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const mm   = String(viewMonth + 1).padStart(2, '0')
              const dd   = String(day).padStart(2, '0')
              const iso  = `${viewYear}-${mm}-${dd}`
              const isSelected = iso === selectedDate
              const today = new Date().toISOString().slice(0, 10)
              const isToday = iso === today
              const isPast  = iso < today
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(day)}
                  style={{
                    padding:'6px 0', borderRadius:8, border:'none', fontSize:12, fontWeight:600,
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#22C55E' : isToday ? '#1a2e1a' : 'transparent',
                    color: isSelected ? '#000' : isPast ? '#333' : isToday ? '#4ade80' : '#ccc',
                    outline: isToday && !isSelected ? '1px solid #4ade8044' : 'none',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick-clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ marginTop:12, width:'100%', padding:'7px', borderRadius:8, border:'1px solid #2a2a2a',
                background:'transparent', color:'#555', fontSize:12, cursor:'pointer' }}>
              ✕ Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background:'#222', border:'1px solid #333', borderRadius:6, color:'#aaa',
  width:28, height:28, fontSize:16, cursor:'pointer', display:'flex',
  alignItems:'center', justifyContent:'center', fontWeight:700,
}

const COLOR_OPTIONS = [
  { value: 'orange', label: '🟠 Orange', hex: '#FF8A00' },
  { value: 'green',  label: '🟢 Green',  hex: '#22C55E' },
  { value: 'purple', label: '🟣 Purple', hex: '#8B5CF6' },
  { value: 'blue',   label: '🔵 Blue',   hex: '#3B82F6' },
]
const TYPE_OPTIONS = [
  { value: 'percent_off',    label: 'Percentage OFF' },
  { value: 'flat_off',       label: 'Flat Amount OFF' },
  { value: 'free_delivery',  label: 'Free Delivery' },
]

const emptyForm = () => ({
  title: '', subtitle: '', code_label: '',
  color: 'orange', offer_type: 'percent_off',
  value: '', min_order: '', valid_to: '',
  shop_contribution: '', platform_contribution: '',
})

export default function PlatformOffers() {
  const [offers,   setOffers]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(emptyForm())
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [toast,    setToast]    = useState('')
  const [editId,   setEditId]   = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/platform-offers')
      setOffers(res.data.offers ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true)
  }

  const openEdit = (o: any) => {
    setEditId(o.id)
    setForm({
      title: o.title ?? '',
      subtitle: o.subtitle ?? '',
      code_label: o.code_label ?? '',
      color: o.color ?? 'orange',
      offer_type: o.offer_type ?? 'percent_off',
      value: o.value ?? '',
      min_order: o.min_order ?? '',
      valid_to: o.valid_to ? o.valid_to.slice(0, 16) : '',
      shop_contribution: o.shop_contribution ?? '',
      platform_contribution: o.platform_contribution ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const body = {
        ...form,
        value:     parseFloat(form.value as any) || 0,
        min_order: parseFloat(form.min_order as any) || 0,
        valid_to:  form.valid_to || null,
      }
      if (editId) {
        await api.patch(`/admin/platform-offers/${editId}`, body)
        showToast('Offer updated')
      } else {
        await api.post('/admin/platform-offers', body)
        showToast('Offer created 🎉')
      }
      setShowForm(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const toggleActive = async (o: any) => {
    try {
      await api.patch(`/admin/platform-offers/${o.id}`, { is_active: !o.is_active })
      setOffers(prev => prev.map(x => x.id === o.id ? { ...x, is_active: !x.is_active } : x))
    } catch { showToast('Failed to update') }
  }

  const deleteOffer = async (id: string) => {
    if (!confirm('Delete this offer?')) return
    try {
      await api.delete(`/admin/platform-offers/${id}`)
      setOffers(prev => prev.filter(o => o.id !== id))
      showToast('Deleted')
    } catch { showToast('Failed to delete') }
  }

  const colorHex = (c: string) => COLOR_OPTIONS.find(x => x.value === c)?.hex ?? '#FF8A00'

  const fmt = (o: any) => {
    if (o.offer_type === 'free_delivery') return 'Free Delivery'
    if (o.offer_type === 'percent_off') return `${o.value}% OFF`
    return `₹${o.value} OFF`
  }

  return (
    <div style={{ padding: '28px 32px', color: '#ccc', fontFamily: 'inherit' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#22C55E', color:'#000',
          padding:'12px 20px', borderRadius:10, fontWeight:700, fontSize:13, zIndex:9999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0 }}>🎁 Platform Offers</h1>
          <p style={{ color:'#555', fontSize:13, marginTop:4, marginBottom:0 }}>
            Platform-funded promotions shown to all customers. Shop owners are paid their full set price — Zuqu covers the discount.
          </p>
        </div>
        <button onClick={openCreate} style={btnStyle('#000', '#22C55E')}>+ New Offer</button>
      </div>

      {/* Notice */}
      <div style={{ background:'#0d2a18', border:'1px solid #166534', borderRadius:12,
        padding:'14px 18px', marginBottom:24, display:'flex', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:20 }}>💡</span>
        <div>
          <div style={{ fontWeight:700, color:'#4ade80', fontSize:14, marginBottom:4 }}>Co-funded platform offers</div>
          <div style={{ fontSize:13, color:'#86efac', lineHeight:'1.6' }}>
            Set a <strong>cost split</strong> when creating an offer — the shop funds part, Zuqu funds the rest.
            Shops still see the discount applied at checkout; their contribution is deducted from the payout.
            Default (no split set) = <strong>Zuqu absorbs 100%</strong>. Use splits to make promotions sustainable at scale.
          </div>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:14,
          padding:24, marginBottom:24 }}>
          <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16, fontWeight:700 }}>
            {editId ? 'Edit Offer' : 'Create New Offer'}
          </h3>
          {error && (
            <div style={{ background:'#2a1515', border:'1px solid #7f1d1d', borderRadius:8,
              padding:'10px 14px', marginBottom:14, color:'#f87171', fontSize:13 }}>{error}</div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={labelStyle}>Title *</label>
              <input style={inputStyle} placeholder="e.g. First Order Free Delivery"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={labelStyle}>Subtitle</label>
              <input style={inputStyle} placeholder="e.g. No delivery fee on your first order"
                value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Offer Type *</label>
              <select style={inputStyle} value={form.offer_type}
                onChange={e => setForm(f => ({ ...f, offer_type: e.target.value }))}>
                {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Total Discount Value {form.offer_type !== 'free_delivery' ? '*' : '(N/A)'}</label>
              <input style={inputStyle} type="number" min={0} placeholder="e.g. 30"
                disabled={form.offer_type === 'free_delivery'}
                value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>

            {/* Co-funding split */}
            <div style={{ gridColumn:'1/-1', background:'#0d1a0d', border:'1px solid #1a3a1a', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'#4ade80', fontWeight:700, marginBottom:10 }}>
                💰 Cost Split — Who funds this discount?
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ ...labelStyle, color:'#22C55E' }}>Platform pays (₹ or %)</label>
                  <input style={inputStyle} type="number" min={0}
                    placeholder={`Default: full ₹${form.value || '0'}`}
                    value={form.platform_contribution}
                    onChange={e => setForm(f => ({ ...f, platform_contribution: e.target.value }))} />
                  <div style={{ fontSize:10, color:'#444', marginTop:4 }}>Leave blank = Zuqu absorbs 100%</div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color:'#F59E0B' }}>Shop pays (₹)</label>
                  <input style={inputStyle} type="number" min={0}
                    placeholder="0 = shop pays nothing"
                    value={form.shop_contribution}
                    onChange={e => setForm(f => ({ ...f, shop_contribution: e.target.value }))} />
                  <div style={{ fontSize:10, color:'#444', marginTop:4 }}>Deducted from shop payout per order</div>
                </div>
              </div>
              {(parseFloat(form.platform_contribution as any) || 0) + (parseFloat(form.shop_contribution as any) || 0) > 0 && (
                <div style={{ marginTop:10, fontSize:12, color:'#86efac' }}>
                  Total: ₹{((parseFloat(form.platform_contribution as any)||0) + (parseFloat(form.shop_contribution as any)||0)).toFixed(2)} per order
                  {parseFloat(form.value as any) > 0 && ((parseFloat(form.platform_contribution as any)||0) + (parseFloat(form.shop_contribution as any)||0)) !== parseFloat(form.value as any) && (
                    <span style={{ color:'#f87171', marginLeft:8 }}>⚠ Doesn't match discount value (₹{form.value})</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Card Colour</label>
              <select style={inputStyle} value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
                {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Coupon Code Label</label>
              <input style={inputStyle} placeholder="e.g. FIRST20 (shown as badge)"
                value={form.code_label} onChange={e => setForm(f => ({ ...f, code_label: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Minimum Order (₹)</label>
              <input style={inputStyle} type="number" min={0} placeholder="0 = no minimum"
                value={form.min_order} onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Expires At</label>
              <CalendarPicker
                value={form.valid_to}
                onChange={v => setForm(f => ({ ...f, valid_to: v }))}
              />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button onClick={handleSave} disabled={saving} style={btnStyle('#000', saving ? '#555' : '#22C55E')}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : '✓ Create Offer'}
            </button>
            <button onClick={() => setShowForm(false)} style={btnStyle('#aaa', '#222')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Offers list */}
      <div style={{ background:'#161616', border:'1px solid #222', borderRadius:14, overflow:'hidden', marginBottom:32 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #222', fontSize:13, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          All Platform Offers — {offers.length} total
        </div>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#444' }}>Loading…</div>
        ) : offers.length === 0 ? (
          <div style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🎁</div>
            <div style={{ color:'#555', fontSize:14 }}>No platform offers yet. Create one above.</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Offer','Type','Value','Min Order','Code','Expires','Status',''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:10, height:10, borderRadius:5, backgroundColor: colorHex(o.color), flexShrink:0 }} />
                      <div>
                        <div style={{ fontWeight:700, color:'#fff', fontSize:13 }}>{o.title}</div>
                        {o.subtitle && <div style={{ fontSize:11, color:'#555', marginTop:1 }}>{o.subtitle}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}><span style={{ fontSize:12, color:'#888' }}>{TYPE_OPTIONS.find(t => t.value === o.offer_type)?.label ?? o.offer_type}</span></td>
                  <td style={{ ...tdStyle, fontWeight:700, color:'#22C55E' }}>{fmt(o)}</td>
                  <td style={tdStyle}>{o.min_order > 0 ? `₹${o.min_order}` : '—'}</td>
                  <td style={tdStyle}>
                    {o.code_label
                      ? <span style={{ background:'#1a1a1a', border:'1px dashed #333', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, letterSpacing:1, color:'#aaa' }}>{o.code_label}</span>
                      : <span style={{ color:'#333' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize:11, color:'#555' }}>
                    {o.valid_to ? new Date(o.valid_to).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'No expiry'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                      background: o.is_active ? '#0d2a18' : '#1a1a1a',
                      color: o.is_active ? '#4ade80' : '#555' }}>
                      {o.is_active ? '● Active' : '○ Paused'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openEdit(o)} style={miniBtn('#aaa', '#222')}>Edit</button>
                      <button onClick={() => toggleActive(o)} style={miniBtn(o.is_active ? '#F59E0B' : '#22C55E', '#1a1a1a')}>
                        {o.is_active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => deleteOffer(o.id)} style={miniBtn('#EF4444', '#1a1a1a')}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Subsidy info box */}
      <div style={{ background:'#161616', border:'1px solid #222', borderRadius:14, padding:24 }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 6px' }}>📊 Platform Subsidy Model</h2>
        <p style={{ fontSize:13, color:'#555', margin:'0 0 20px' }}>
          Shops always receive the price they listed. Zuqu pays the difference when a platform offer is applied.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          {[
            { icon:'🏪', label:'Shop gets', desc:'100% of their listed price', color:'#22C55E' },
            { icon:'🎁', label:'Customer pays', desc:'Listed price minus the platform offer', color:'#FF8A00' },
            { icon:'💸', label:'Zuqu covers', desc:'The discount gap between the two', color:'#8B5CF6' },
          ].map(card => (
            <div key={card.label} style={{ background:'#0d0d0d', borderRadius:12, padding:16, border:'1px solid #222' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{card.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color: card.color, marginBottom:4 }}>{card.label}</div>
              <div style={{ fontSize:12, color:'#555', lineHeight:'1.5' }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display:'block', fontSize:11, fontWeight:700, color:'#555', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }
const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const thStyle: React.CSSProperties = { textAlign:'left', padding:'10px 16px', fontSize:10, color:'#444', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #1a1a1a', background:'#111' }
const tdStyle: React.CSSProperties = { padding:'12px 16px', fontSize:13, color:'#aaa', verticalAlign:'middle' }
const btnStyle = (color: string, bg: string): React.CSSProperties => ({
  padding:'9px 18px', borderRadius:8, border:'none', fontWeight:700, fontSize:13,
  background: bg, color, cursor:'pointer', whiteSpace:'nowrap',
})
const miniBtn = (color: string, bg: string): React.CSSProperties => ({
  padding:'5px 12px', borderRadius:6, border:`1px solid ${color}22`,
  fontWeight:600, fontSize:12, background: bg, color, cursor:'pointer',
})
