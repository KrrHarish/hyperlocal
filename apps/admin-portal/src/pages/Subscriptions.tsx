import { useEffect, useState } from 'react'

const API   = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const token = () => localStorage.getItem('zuqu_admin_token') ?? ''
const hdrs  = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

interface Plan {
  key: string; name: string; monthly_fee: number; commission_rate: number
  description: string; features: string[] | string; is_active: boolean
  sort_order: number; category_overrides: Record<string,any> | string
}
interface ShopSub {
  id: string; name: string; category: string; plan_key: string
  status: string; started_at: string; expires_at: string | null
  admin_override: boolean; override_note: string | null
}
interface Revenue {
  total_monthly_revenue: number; total_shops: number
  by_plan: Record<string, { count: number; revenue: number; commission_rate: number }>
  by_category: Record<string, { count: number; revenue: number }>
}

const PLAN_COLOR: Record<string,string> = { free:'#6B7280', growth:'#22C55E', pro:'#F59E0B' }
const PLAN_BG:    Record<string,string> = { free:'#1a1a1a', growth:'#0d2a18', pro:'#1a1200' }

export default function Subscriptions() {
  const [tab, setTab]           = useState(0)
  const [plans, setPlans]       = useState<Plan[]>([])
  const [subs, setSubs]         = useState<ShopSub[]>([])
  const [revenue, setRevenue]   = useState<Revenue | null>(null)
  const [loading, setLoading]   = useState(true)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [overrideShop, setOverrideShop] = useState<ShopSub | null>(null)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [filterPlan, setFilterPlan]         = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const loadPlans = () =>
    fetch(`${API}/admin/subscription-plans`, { headers: hdrs() })
      .then(r => r.json()).then(d => setPlans(d.plans ?? []))

  const loadSubs = () =>
    fetch(`${API}/admin/shop-subscriptions`, { headers: hdrs() })
      .then(r => r.json()).then(d => setSubs(d.subscriptions ?? []))

  const loadRevenue = () =>
    fetch(`${API}/admin/subscription-revenue`, { headers: hdrs() })
      .then(r => r.json()).then(d => setRevenue(d))

  useEffect(() => {
    setLoading(true)
    Promise.all([loadPlans(), loadSubs(), loadRevenue()]).finally(() => setLoading(false))
  }, [])

  const getFeatures = (f: string[] | string): string[] =>
    Array.isArray(f) ? f : (typeof f === 'string' ? JSON.parse(f) : [])

  const allCategories = [...new Set(subs.map(s => s.category).filter(Boolean))].sort()

  const filteredSubs = subs.filter(s => {
    const matchSearch   = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchPlan     = filterPlan === 'all' || s.plan_key === filterPlan
    const matchCategory = filterCategory === 'all' || s.category === filterCategory
    return matchSearch && matchPlan && matchCategory
  })

  const savePlan = async () => {
    if (!editPlan) return
    setSaving(true)
    try {
      const body = {
        ...editPlan,
        features: typeof editPlan.features === 'string'
          ? editPlan.features.split('\n').filter(Boolean)
          : editPlan.features,
        category_overrides: (() => {
          try { return typeof editPlan.category_overrides === 'string' ? JSON.parse(editPlan.category_overrides || '{}') : editPlan.category_overrides }
          catch { return {} }
        })(),
      }
      await fetch(`${API}/admin/subscription-plans/${editPlan.key}`, { method:'PATCH', headers: hdrs(), body: JSON.stringify(body) })
      await loadPlans()
      setEditPlan(null)
    } catch { alert('Save failed') } finally { setSaving(false) }
  }

  const saveOverride = async (planKey: string, note: string, expiresAt: string) => {
    if (!overrideShop) return
    setSaving(true)
    try {
      await fetch(`${API}/admin/shops/${overrideShop.id}/subscription`, {
        method:'PATCH', headers: hdrs(), body: JSON.stringify({ plan_key: planKey, override_note: note, expires_at: expiresAt || null }),
      })
      await Promise.all([loadSubs(), loadRevenue()])
      setOverrideShop(null)
    } catch { alert('Save failed') } finally { setSaving(false) }
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div style={{ padding:32, color:'#fff', fontFamily:'system-ui,sans-serif', maxWidth:1200 }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.5px' }}>Subscriptions</h1>
        <p style={{ color:'#555', fontSize:14, margin:0 }}>Plan management, revenue analytics & shop overrides</p>
      </div>

      {/* ── REVENUE CARDS ── */}
      {revenue && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:32 }}>

          {/* Total MRR */}
          <div style={{ background:'#111', borderRadius:16, border:'1px solid #1e1e1e', padding:'20px 22px' }}>
            <div style={{ fontSize:11, color:'#555', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Monthly Revenue</div>
            <div style={{ fontSize:28, fontWeight:900, color:'#22C55E', letterSpacing:'-0.5px' }}>{fmt(revenue.total_monthly_revenue)}</div>
            <div style={{ fontSize:12, color:'#444', marginTop:4 }}>{revenue.total_shops} shops total</div>
          </div>

          {/* Per-plan cards */}
          {Object.entries(revenue.by_plan).map(([key, data]) => (
            <div key={key} style={{ background: PLAN_BG[key] ?? '#111', borderRadius:16, border:`1px solid ${PLAN_COLOR[key]}33`, padding:'20px 22px' }}>
              <div style={{ fontSize:11, color: PLAN_COLOR[key], fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>{key}</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{fmt(data.revenue)}<span style={{ fontSize:12, color:'#555', fontWeight:400 }}>/mo</span></div>
              <div style={{ fontSize:12, color:'#555', marginTop:4 }}>{data.count} shops · {data.commission_rate}% commission</div>
            </div>
          ))}

          {/* Annual projection */}
          <div style={{ background:'#0a0f1a', borderRadius:16, border:'1px solid #1e3a5f', padding:'20px 22px' }}>
            <div style={{ fontSize:11, color:'#60a5fa', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Annual Projection</div>
            <div style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{fmt(revenue.total_monthly_revenue * 12)}</div>
            <div style={{ fontSize:12, color:'#444', marginTop:4 }}>at current plan mix</div>
          </div>
        </div>
      )}

      {/* ── CATEGORY REVENUE BREAKDOWN ── */}
      {revenue && Object.keys(revenue.by_category).length > 0 && (
        <div style={{ background:'#111', borderRadius:16, border:'1px solid #1e1e1e', padding:'20px 22px', marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#aaa', marginBottom:16, textTransform:'uppercase', letterSpacing:0.6 }}>Revenue by Category</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.entries(revenue.by_category)
              .sort((a,b) => b[1].revenue - a[1].revenue)
              .map(([cat, data]) => (
                <div key={cat} style={{ background:'#1a1a1a', borderRadius:12, padding:'10px 16px', minWidth:140 }}>
                  <div style={{ fontSize:11, color:'#666', textTransform:'capitalize', marginBottom:4 }}>{cat}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>{fmt(data.revenue)}</div>
                  <div style={{ fontSize:11, color:'#555', marginTop:2 }}>{data.count} shop{data.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:'#111', borderRadius:10, padding:4, width:'fit-content' }}>
        {['Plans', 'Shop Subscriptions'].map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding:'8px 22px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
            background: tab === i ? '#1e1e1e' : 'transparent',
            color: tab === i ? '#fff' : '#555',
          }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:'#555', padding:40, textAlign:'center' }}>Loading…</div>
      ) : tab === 0 ? (

        /* ── PLANS TAB ── */
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          {plans.map(plan => {
            const color    = PLAN_COLOR[plan.key] ?? '#22C55E'
            const features = getFeatures(plan.features)
            const shopCount = revenue?.by_plan[plan.key]?.count ?? 0
            const planRevenue = revenue?.by_plan[plan.key]?.revenue ?? 0
            return (
              <div key={plan.key} style={{ flex:'1 1 280px', maxWidth:340, background:'#111', borderRadius:18, border:`1px solid ${plan.is_active ? '#1e1e1e' : '#2a1a1a'}`, padding:24, opacity: plan.is_active ? 1 : 0.6 }}>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <span style={{ fontSize:12, fontWeight:700, color, textTransform:'uppercase', letterSpacing:1 }}>{plan.name}</span>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background: plan.is_active ? '#0d2a18' : '#2a1a1a', color: plan.is_active ? '#22C55E' : '#EF4444' }}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Price */}
                <div style={{ marginBottom:6 }}>
                  {plan.monthly_fee === 0 ? (
                    <span style={{ fontSize:30, fontWeight:900 }}>Free</span>
                  ) : (
                    <><span style={{ fontSize:13, color:'#555', verticalAlign:'super' }}>₹</span>
                      <span style={{ fontSize:30, fontWeight:900 }}>{plan.monthly_fee.toLocaleString()}</span>
                      <span style={{ fontSize:12, color:'#555' }}>/month</span></>
                  )}
                </div>

                <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                  <span style={{ background:'#1a1a1a', borderRadius:99, padding:'2px 10px', fontSize:11, color, fontWeight:700 }}>
                    {plan.commission_rate}% commission
                  </span>
                  <span style={{ background:'#1a1a1a', borderRadius:99, padding:'2px 10px', fontSize:11, color:'#aaa', fontWeight:600 }}>
                    {shopCount} shop{shopCount !== 1 ? 's' : ''}
                  </span>
                  {planRevenue > 0 && (
                    <span style={{ background:'#0d2a18', borderRadius:99, padding:'2px 10px', fontSize:11, color:'#22C55E', fontWeight:700 }}>
                      {fmt(planRevenue)}/mo
                    </span>
                  )}
                </div>

                <p style={{ fontSize:12, color:'#666', marginBottom:14, lineHeight:1.6 }}>{plan.description}</p>

                <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:7 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ fontSize:12, color:'#aaa', display:'flex', gap:8 }}>
                      <span style={{ color, fontWeight:700 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setEditPlan({
                    ...plan,
                    features: getFeatures(plan.features).join('\n'),
                    category_overrides: typeof plan.category_overrides === 'string' ? plan.category_overrides : JSON.stringify(plan.category_overrides ?? {}, null, 2),
                  } as any)}
                  style={{ width:'100%', padding:'9px', borderRadius:10, border:`1px solid ${color}44`, background:'transparent', color, fontSize:13, fontWeight:700, cursor:'pointer' }}
                >
                  ✏️ Edit Plan
                </button>
              </div>
            )
          })}
        </div>

      ) : (

        /* ── SHOP SUBSCRIPTIONS TAB ── */
        <div>
          {/* Filters row */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <input
              placeholder="Search shop name…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex:'1 1 200px', padding:'9px 14px', borderRadius:10, border:'1px solid #222', background:'#111', color:'#fff', fontSize:13, outline:'none' }}
            />
            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:10, border:'1px solid #222', background:'#111', color:'#fff', fontSize:13, cursor:'pointer', outline:'none' }}>
              <option value="all">All Plans</option>
              {plans.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:10, border:'1px solid #222', background:'#111', color:'#fff', fontSize:13, cursor:'pointer', outline:'none' }}>
              <option value="all">All Categories</option>
              {allCategories.map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
            </select>
            <div style={{ display:'flex', alignItems:'center', fontSize:13, color:'#555', padding:'0 4px' }}>
              {filteredSubs.length} shops · {fmt(filteredSubs.reduce((s, r) => s + (plans.find(p => p.key === r.plan_key)?.monthly_fee ?? 0), 0))}/mo
            </div>
          </div>

          {/* Table */}
          <div style={{ background:'#111', borderRadius:16, border:'1px solid #1e1e1e', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1e1e1e' }}>
                  {['Shop','Category','Plan','MRR','Started','Expires','Override',''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, color:'#555', fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map(sub => {
                  const color   = PLAN_COLOR[sub.plan_key] ?? '#6B7280'
                  const planFee = plans.find(p => p.key === sub.plan_key)?.monthly_fee ?? 0
                  return (
                    <tr key={sub.id} style={{ borderBottom:'1px solid #161616' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding:'13px 16px', fontSize:14, fontWeight:700 }}>{sub.name}</td>
                      <td style={{ padding:'13px 16px', fontSize:12, color:'#666', textTransform:'capitalize' }}>{sub.category}</td>
                      <td style={{ padding:'13px 16px' }}>
                        <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99, background: PLAN_BG[sub.plan_key] ?? '#1a1a1a', color, border:`1px solid ${color}44` }}>
                          {sub.plan_key}
                        </span>
                      </td>
                      <td style={{ padding:'13px 16px', fontSize:13, fontWeight:700, color: planFee > 0 ? '#22C55E' : '#444' }}>
                        {planFee > 0 ? fmt(planFee) : '—'}
                      </td>
                      <td style={{ padding:'13px 16px', fontSize:12, color:'#666' }}>
                        {sub.started_at ? new Date(sub.started_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                      </td>
                      <td style={{ padding:'13px 16px', fontSize:12, color: sub.expires_at && new Date(sub.expires_at) < new Date() ? '#EF4444' : '#666', fontWeight: sub.expires_at && new Date(sub.expires_at) < new Date() ? 700 : 400 }}>
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                        {sub.expires_at && new Date(sub.expires_at) < new Date() && <span style={{ marginLeft:6, fontSize:10, background:'#7f1d1d', color:'#fca5a5', padding:'1px 6px', borderRadius:99 }}>EXPIRED</span>}
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        {sub.admin_override && (
                          <span title={sub.override_note ?? ''} style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#1a1200', color:'#F59E0B', cursor: sub.override_note ? 'help' : 'default' }}>Admin</span>
                        )}
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        <button onClick={() => setOverrideShop(sub)}
                          style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #333', background:'transparent', color:'#aaa', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                          Override
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredSubs.length === 0 && (
                  <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#444', fontSize:14 }}>No shops match the filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EDIT PLAN MODAL ── */}
      {editPlan && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'#111', borderRadius:20, border:'1px solid #1e1e1e', padding:32, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Edit — {editPlan.name}</h2>
              <button onClick={() => setEditPlan(null)} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            {[
              { label:'Plan Name', key:'name', type:'text' },
              { label:'Monthly Fee (₹)', key:'monthly_fee', type:'number' },
              { label:'Commission Rate (%)', key:'commission_rate', type:'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>{f.label}</label>
                <input type={f.type} value={(editPlan as any)[f.key]}
                  onChange={e => setEditPlan(p => ({ ...p!, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:14, boxSizing:'border-box', outline:'none' }} />
              </div>
            ))}

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Description</label>
              <textarea value={editPlan.description as string} rows={3}
                onChange={e => setEditPlan(p => ({ ...p!, description: e.target.value }))}
                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none', resize:'vertical' }} />
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Features (one per line)</label>
              <textarea value={editPlan.features as string} rows={6}
                onChange={e => setEditPlan(p => ({ ...p!, features: e.target.value }))}
                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none', resize:'vertical', fontFamily:'monospace' }} />
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Category Price Overrides (JSON)</label>
              <textarea value={editPlan.category_overrides as string} rows={4}
                onChange={e => setEditPlan(p => ({ ...p!, category_overrides: e.target.value }))}
                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#aaa', fontSize:12, boxSizing:'border-box', outline:'none', resize:'vertical', fontFamily:'monospace' }} />
              <p style={{ fontSize:11, color:'#444', margin:'4px 0 0' }}>e.g. {`{ "medicine": { "monthly_fee": 2999 }, "grocery": { "monthly_fee": 1499 } }`}</p>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
              <span style={{ fontSize:13, color:'#aaa', fontWeight:600 }}>Active</span>
              <button onClick={() => setEditPlan(p => ({ ...p!, is_active: !p!.is_active }))}
                style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: editPlan.is_active ? '#22C55E' : '#333', position:'relative', transition:'background 0.2s' }}>
                <span style={{ position:'absolute', top:3, left: editPlan.is_active ? 22 : 3, width:18, height:18, borderRadius:9, background:'#fff', transition:'left 0.2s', display:'block' }} />
              </button>
              <span style={{ fontSize:12, color: editPlan.is_active ? '#22C55E' : '#555' }}>{editPlan.is_active ? 'Enabled' : 'Disabled'}</span>
            </div>

            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setEditPlan(null)} style={{ flex:1, padding:11, borderRadius:10, border:'1px solid #333', background:'transparent', color:'#aaa', fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={savePlan} disabled={saving} style={{ flex:2, padding:11, borderRadius:10, border:'none', background:'#22C55E', color:'#000', fontSize:14, fontWeight:800, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERRIDE MODAL ── */}
      {overrideShop && (
        <OverrideModal shop={overrideShop} plans={plans} saving={saving} onSave={saveOverride} onClose={() => setOverrideShop(null)} />
      )}

    </div>
  )
}

function OverrideModal({ shop, plans, saving, onSave, onClose }: {
  shop: ShopSub; plans: Plan[]; saving: boolean
  onSave: (key: string, note: string, expiresAt: string) => void; onClose: () => void
}) {
  const [planKey, setPlanKey]   = useState(shop.plan_key)
  const [note, setNote]         = useState(shop.override_note ?? '')
  // Default expiry to 1 month from now if currently no expiry, else keep existing
  const defaultExpiry = shop.expires_at
    ? new Date(shop.expires_at).toISOString().split('T')[0]
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [expiresAt, setExpiresAt] = useState(defaultExpiry)
  const [noExpiry, setNoExpiry]   = useState(!shop.expires_at)
  const selected = plans.find(p => p.key === planKey)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:'#111', borderRadius:20, border:'1px solid #1e1e1e', padding:32, width:'100%', maxWidth:460 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Override Subscription</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <p style={{ color:'#555', fontSize:13, margin:'0 0 22px' }}>{shop.name} · <span style={{ textTransform:'capitalize' }}>{shop.category}</span></p>

        {/* Plan selector */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Plan</label>
          <select value={planKey} onChange={e => setPlanKey(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:14, cursor:'pointer', outline:'none' }}>
            {plans.map(p => <option key={p.key} value={p.key}>{p.name} — ₹{p.monthly_fee}/mo · {p.commission_rate}% commission</option>)}
          </select>
        </div>

        {/* Plan preview */}
        {selected && (
          <div style={{ background: PLAN_BG[selected.key] ?? '#1a1a1a', borderRadius:12, padding:'12px 16px', marginBottom:14, border:`1px solid ${PLAN_COLOR[selected.key]}33` }}>
            <div style={{ fontSize:12, color: PLAN_COLOR[selected.key], fontWeight:700, marginBottom:4 }}>{selected.name} Plan Preview</div>
            <div style={{ fontSize:13, color:'#aaa' }}>₹{selected.monthly_fee}/month · {selected.commission_rate}% per order</div>
          </div>
        )}

        {/* Expiry date */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <label style={{ fontSize:11, color:'#666', fontWeight:600, textTransform:'uppercase', letterSpacing:0.6 }}>Expiry Date</label>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'#555' }}>
              <input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)}
                style={{ accentColor:'#22C55E', width:14, height:14, cursor:'pointer' }} />
              No expiry
            </label>
          </div>
          {!noExpiry ? (
            <input
              type="date" value={expiresAt}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setExpiresAt(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none', colorScheme:'dark' }}
            />
          ) : (
            <div style={{ padding:'9px 12px', borderRadius:9, border:'1px solid #1a1a1a', background:'#0a0a0a', fontSize:13, color:'#444' }}>
              Plan will not expire automatically
            </div>
          )}
          {!noExpiry && expiresAt && (
            <div style={{ fontSize:11, color:'#555', marginTop:4 }}>
              Expires in {Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
              {new Date(expiresAt) < new Date() && <span style={{ color:'#EF4444' }}> — date is in the past!</span>}
            </div>
          )}
        </div>

        {/* Note */}
        <div style={{ marginBottom:24 }}>
          <label style={{ display:'block', fontSize:11, color:'#666', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Reason for override…"
            style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #222', background:'#0a0a0a', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none', resize:'none' }} />
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <button onClick={onClose} style={{ flex:1, padding:11, borderRadius:10, border:'1px solid #333', background:'transparent', color:'#aaa', fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => onSave(planKey, note, noExpiry ? '' : expiresAt)} disabled={saving}
            style={{ flex:2, padding:11, borderRadius:10, border:'none', background:'#22C55E', color:'#000', fontSize:14, fontWeight:800, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  )
}
