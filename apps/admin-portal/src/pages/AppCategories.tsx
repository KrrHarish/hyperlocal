import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

interface GeoZone { lat: string; lng: string; radius_km: string; label: string }
interface AppCategory {
  id: string; key: string; name: string; emoji: string; description: string
  is_active: boolean; under_construction: boolean; sort_order: number
  geo_restrictions: GeoZone[] | null
}

const emptyZone = (): GeoZone => ({ lat: '', lng: '', radius_km: '', label: '' })

export default function AppCategories() {
  const [cats,    setCats]    = useState<AppCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const [toast,   setToast]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  // per-category local edits: id → zones array being edited
  const [zones, setZones] = useState<Record<string, GeoZone[]>>({})

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/app-categories')
      const list: AppCategory[] = res.data.categories ?? []
      setCats(list)
      // initialise local zone state
      const z: Record<string, GeoZone[]> = {}
      list.forEach(c => {
        z[c.id] = c.geo_restrictions
          ? c.geo_restrictions.map(g => ({ ...g, lat: String(g.lat), lng: String(g.lng), radius_km: String(g.radius_km) }))
          : []
      })
      setZones(z)
    } catch { showToast('Failed to load categories') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const patch = async (id: string, body: any) => {
    setSaving(id)
    try {
      const res = await api.patch(`/admin/app-categories/${id}`, body)
      setCats(prev => prev.map(c => c.id === id ? res.data.category : c))
      showToast('Saved ✓')
    } catch { showToast('Save failed') }
    finally { setSaving(null) }
  }

  const saveZones = async (id: string) => {
    const raw = zones[id] ?? []
    const parsed = raw
      .filter(z => z.lat && z.lng && z.radius_km)
      .map(z => ({ lat: parseFloat(z.lat), lng: parseFloat(z.lng), radius_km: parseFloat(z.radius_km), label: z.label }))
    await patch(id, { geo_restrictions: parsed.length ? parsed : null })
  }

  const addZone = (id: string) =>
    setZones(z => ({ ...z, [id]: [...(z[id] ?? []), emptyZone()] }))

  const removeZone = (id: string, idx: number) =>
    setZones(z => ({ ...z, [id]: z[id].filter((_, i) => i !== idx) }))

  const updateZone = (id: string, idx: number, field: keyof GeoZone, val: string) =>
    setZones(z => ({ ...z, [id]: z[id].map((zone, i) => i === idx ? { ...zone, [field]: val } : zone) }))

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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0 }}>📱 App Categories</h1>
        <p style={{ color:'#555', fontSize:13, marginTop:4, marginBottom:0 }}>
          Control which services appear in the customer app. Disable a category to hide it completely.
          Add geo-restrictions to show a category only in specific areas.
        </p>
      </div>

      {/* Info box */}
      <div style={{ background:'#0d1f0d', border:'1px solid #14532d', borderRadius:12,
        padding:'14px 18px', marginBottom:24, display:'flex', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:20 }}>💡</span>
        <div>
          <div style={{ fontWeight:700, color:'#4ade80', fontSize:14, marginBottom:4 }}>How geo-restrictions work</div>
          <div style={{ fontSize:13, color:'#86efac', lineHeight:'1.6' }}>
            If a category has <strong>no zones</strong>, it appears for all users.
            If zones are added, the category only shows for users whose location falls within <em>any</em> of those zones (radius in km).
            Users without location permission see all unrestricted categories.
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'#444' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {cats.map(cat => {
            const isExpanded = expanded === cat.id
            const isSaving   = saving === cat.id
            const catZones   = zones[cat.id] ?? []
            return (
              <div key={cat.id} style={{ background:'#161616', border:'1px solid #222', borderRadius:16, overflow:'hidden' }}>
                {/* Row */}
                <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px' }}>
                  {/* Emoji + name */}
                  <div style={{ fontSize:30, width:44, textAlign:'center', flexShrink:0 }}>{cat.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, color:'#fff', fontSize:15 }}>{cat.name}</div>
                    <div style={{ fontSize:12, color:'#555', marginTop:2 }}>{cat.description}</div>
                    <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, background:'#222', borderRadius:6, padding:'2px 8px', color:'#777' }}>
                        key: <strong style={{ color:'#aaa' }}>{cat.key}</strong>
                      </span>
                      {cat.geo_restrictions && cat.geo_restrictions.length > 0 && (
                        <span style={{ fontSize:11, background:'#1a1a2e', borderRadius:6, padding:'2px 8px', color:'#818cf8' }}>
                          📍 {cat.geo_restrictions.length} geo zone{cat.geo_restrictions.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                    {/* Active toggle */}
                    <button
                      onClick={() => patch(cat.id, { is_active: !cat.is_active })}
                      disabled={!!saving}
                      style={{
                        padding:'7px 14px', borderRadius:8, border:'none', fontWeight:700, fontSize:12,
                        cursor:'pointer',
                        background: cat.is_active ? '#0d2a18' : '#2a1515',
                        color: cat.is_active ? '#4ade80' : '#ef4444',
                        border: `1px solid ${cat.is_active ? '#166534' : '#7f1d1d'}`,
                      }}>
                      {cat.is_active ? '● Active' : '○ Hidden'}
                    </button>

                    {/* Under construction toggle */}
                    <button
                      onClick={() => patch(cat.id, { under_construction: !cat.under_construction })}
                      disabled={!!saving}
                      style={{
                        padding:'7px 14px', borderRadius:8, border:'none', fontWeight:700, fontSize:12,
                        cursor:'pointer',
                        background: cat.under_construction ? '#2a1f00' : '#111',
                        color: cat.under_construction ? '#F59E0B' : '#555',
                        border: `1px solid ${cat.under_construction ? '#92400e' : '#333'}`,
                      }}>
                      {cat.under_construction ? '🚧 Under Const.' : '✓ Live'}
                    </button>

                    {/* Expand geo zone editor */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : cat.id)}
                      style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #333',
                        background:'#222', color:'#aaa', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      📍 Geo Zones {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Geo zone editor */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid #222', padding:'20px 20px 16px', background:'#0d0d0d' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4 }}>
                      📍 Geo Restrictions
                    </div>
                    <div style={{ fontSize:12, color:'#555', marginBottom:16 }}>
                      Leave empty to show in all locations. Add a zone (lat, lng, radius) to restrict.
                    </div>

                    {catZones.length === 0 && (
                      <div style={{ fontSize:13, color:'#333', marginBottom:12, padding:'10px 14px',
                        background:'#111', borderRadius:8, border:'1px dashed #222' }}>
                        No restrictions — visible to all users everywhere
                      </div>
                    )}

                    {catZones.map((zone, idx) => (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 2fr auto',
                        gap:8, marginBottom:8, alignItems:'flex-end' }}>
                        {[
                          { field:'lat'       as const, ph:'Latitude (e.g. 12.9716)',     label:'Latitude' },
                          { field:'lng'       as const, ph:'Longitude (e.g. 77.5946)',    label:'Longitude' },
                          { field:'radius_km' as const, ph:'Radius km (e.g. 5)',           label:'Radius (km)' },
                          { field:'label'     as const, ph:'Zone label (e.g. Bengaluru)', label:'Label' },
                        ].map(({ field, ph, label }) => (
                          <div key={field}>
                            <div style={{ fontSize:10, color:'#555', fontWeight:700, textTransform:'uppercase',
                              marginBottom:4, letterSpacing:'0.05em' }}>{label}</div>
                            <input
                              style={inputSt}
                              placeholder={ph}
                              value={zone[field]}
                              onChange={e => updateZone(cat.id, idx, field, e.target.value)}
                            />
                          </div>
                        ))}
                        <button onClick={() => removeZone(cat.id, idx)}
                          style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #7f1d1d',
                            background:'#2a1515', color:'#ef4444', cursor:'pointer', fontSize:12, fontWeight:700, marginTop:16 }}>
                          ✕
                        </button>
                      </div>
                    ))}

                    <div style={{ display:'flex', gap:10, marginTop:12 }}>
                      <button onClick={() => addZone(cat.id)}
                        style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #333',
                          background:'#222', color:'#aaa', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        + Add Zone
                      </button>
                      <button
                        onClick={() => saveZones(cat.id)}
                        disabled={isSaving}
                        style={{ padding:'8px 18px', borderRadius:8, border:'none',
                          background: isSaving ? '#555' : '#22C55E', color:'#000',
                          cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        {isSaving ? 'Saving…' : '✓ Save Zones'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width:'100%', padding:'8px 10px', background:'#111', border:'1px solid #2a2a2a',
  borderRadius:8, color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box',
}
