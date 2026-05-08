import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Plan {
  key: string; name: string; monthly_fee: number; commission_rate: number
  description: string; features: string[] | string; sort_order: number
}

const ACCENT: Record<string, string> = { free: '#6B7280', growth: '#22C55E', pro: '#F59E0B' }
const ACCENT_BG: Record<string, string> = { free: 'rgba(107,114,128,0.08)', growth: 'rgba(34,197,94,0.07)', pro: 'rgba(245,158,11,0.07)' }
const PLAN_EMOJI: Record<string, string> = { free: '🌱', growth: '🚀', pro: '👑' }
const API = 'http://localhost:3000'
const token = () => localStorage.getItem('zuqu_owner_token') ?? ''

const FALLBACK: Plan[] = [
  { key:'free',   name:'Free',   monthly_fee:0,    commission_rate:10, description:'Get started with zero cost.', features:['Up to 50 products','Basic analytics','Order management','Email support'], sort_order:1 },
  { key:'growth', name:'Growth', monthly_fee:999,  commission_rate:5,  description:'For shops doing ₹50,000+/month.', features:['Unlimited products','Advanced analytics','Priority listing','Deal promotions','Chat with customers','Phone support'], sort_order:2 },
  { key:'pro',    name:'Pro',    monthly_fee:2499, commission_rate:2,  description:'For high-volume shops.', features:['Everything in Growth','Only 2% commission','Featured placement','Dedicated account manager','Custom branding','API access'], sort_order:3 },
]

export default function SubscribeScreen() {
  const navigate = useNavigate()
  const [plans, setPlans]                 = useState<Plan[]>([])
  const [currentKey, setCurrentKey]       = useState<string>('free')
  const [adminOverride, setAdminOverride] = useState(false)
  const [expiresAt, setExpiresAt]         = useState<string | null>(null)
  const [isTrial, setIsTrial]             = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState<string | null>(null)
  const [error, setError]                 = useState('')

  useEffect(() => {
    Promise.allSettled([
      fetch(`${API}/subscription-plans`).then(r => r.json()),
      fetch(`${API}/shop-portal/subscription`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
    ]).then(([plansRes, subRes]) => {
      // Plans — always fall back to static list
      if (plansRes.status === 'fulfilled' && plansRes.value.plans?.length) {
        setPlans(plansRes.value.plans)
      } else {
        setPlans(FALLBACK)
      }
      // Subscription
      if (subRes.status === 'fulfilled') {
        const sub = subRes.value
        setCurrentKey(sub.plan_key ?? 'free')
        setAdminOverride(sub.subscription?.admin_override ?? sub.admin_override ?? false)
        setIsTrial(!!sub.is_trial)
        setTrialDaysLeft(sub.trial_days_left ?? null)
        setExpiresAt(sub.trial_ends_at ?? sub.subscription?.expires_at ?? sub.expires_at ?? null)
      }
    }).finally(() => setLoading(false))
  }, [])

  const subscribe = async (planKey: string) => {
    if (planKey === currentKey) return
    setSaving(planKey); setError('')
    try {
      const res = await fetch(`${API}/shop-portal/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ plan_key: planKey }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      navigate('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSaving(null)
    }
  }

  const getFeatures = (f: string[] | string): string[] =>
    Array.isArray(f) ? f : (typeof f === 'string' ? JSON.parse(f) : [])

  const daysUntilExpiry = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'system-ui, -apple-system, sans-serif' }}>

      {/* Hero */}
      <div style={{ textAlign:'center', padding:'40px 24px 32px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:500, height:260, background:'radial-gradient(ellipse at center, rgba(34,197,94,0.07) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#0d2a18', border:'1px solid #14532d', borderRadius:99, padding:'4px 14px', fontSize:11, color:'#22C55E', fontWeight:700, marginBottom:18, letterSpacing:0.8 }}>
          💳 SUBSCRIPTION PLANS
        </div>
        <h1 style={{ fontSize:36, fontWeight:900, margin:'0 0 10px', letterSpacing:'-1px' }}>Choose your plan</h1>
        <p style={{ fontSize:14, color:'#555', margin:0 }}>Upgrade anytime · Downgrade at end of billing period</p>
      </div>

      {/* Current plan status bar */}
      {!loading && (
        <div style={{ maxWidth:900, margin:'0 auto 28px', padding:'0 24px' }}>
          <div style={{ background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:14, padding:'14px 20px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <div style={{ width:36, height:36, borderRadius:10, background: ACCENT_BG[currentKey], border:`1px solid ${ACCENT[currentKey]}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
              {PLAN_EMOJI[currentKey]}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#555', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase' }}>
                {isTrial ? 'Free Trial' : 'Currently on'}
              </div>
              <div style={{ fontSize:15, fontWeight:800, color: ACCENT[currentKey] }}>
                {isTrial
                  ? `${trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} days left` : 'Trial expired'}`
                  : `${currentKey.charAt(0).toUpperCase() + currentKey.slice(1)} Plan`}
              </div>
            </div>
            {expiresAt && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:'#555', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>
                  {isExpired ? '⚠️ Expired' : 'Expires in'}
                </div>
                <div style={{ fontSize:14, fontWeight:800, color: isExpired ? '#EF4444' : daysUntilExpiry! <= 7 ? '#F59E0B' : '#aaa' }}>
                  {isExpired ? new Date(expiresAt).toLocaleDateString('en-IN') : `${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize:11, color:'#444' }}>{new Date(expiresAt).toLocaleDateString('en-IN')}</div>
              </div>
            )}
            {adminOverride && (
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'#1a1200', border:'1px solid #854d0e', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#fbbf24', fontWeight:600 }}>
                🔒 Admin managed
              </div>
            )}
          </div>
        </div>
      )}

      {adminOverride && (
        <div style={{ maxWidth:900, margin:'0 auto 20px', padding:'0 24px' }}>
          <div style={{ background:'#1a1200', border:'1px solid #854d0e', borderRadius:12, padding:'12px 18px', fontSize:13, color:'#fbbf24', lineHeight:1.6 }}>
            🔒 Your subscription is managed by the Zuqu team. Contact <strong>support@zuqu.in</strong> to make any changes.
          </div>
        </div>
      )}

      {error && (
        <div style={{ maxWidth:900, margin:'0 auto 16px', padding:'0 24px' }}>
          <div style={{ background:'#1a0a0a', border:'1px solid #7f1d1d', borderRadius:12, padding:'12px 18px', fontSize:13, color:'#f87171' }}>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', color:'#444', padding:60 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>⏳</div>
          Loading plans…
        </div>
      ) : (
        <div style={{ display:'flex', gap:18, justifyContent:'center', flexWrap:'wrap', padding:'0 24px 56px', maxWidth:1040, margin:'0 auto' }}>
          {plans.map(plan => {
            const accent    = ACCENT[plan.key] ?? '#22C55E'
            const accentBg  = ACCENT_BG[plan.key] ?? 'rgba(34,197,94,0.07)'
            const isCurrent = plan.key === currentKey
            const isGrowth  = plan.key === 'growth'
            const features  = getFeatures(plan.features)
            const emoji     = PLAN_EMOJI[plan.key] ?? '📦'
            return (
              <div key={plan.key} style={{
                flex:'1 1 290px', maxWidth:320,
                background: isCurrent ? '#0b1f0b' : '#0f0f0f',
                borderRadius:22, border:`1.5px solid ${isCurrent ? accent + '66' : '#1c1c1c'}`,
                padding:'28px 24px 24px', position:'relative',
                boxShadow: isCurrent ? `0 0 50px rgba(34,197,94,0.12)` : 'none',
                transform: isCurrent ? 'translateY(-6px)' : 'none',
                transition:'transform 0.2s',
              }}>
                {isCurrent && (
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(90deg,#16a34a,#22C55E)', color:'#000', fontSize:10, fontWeight:900, padding:'4px 16px', borderRadius:99, whiteSpace:'nowrap', letterSpacing:0.5 }}>
                    ✓ CURRENT PLAN
                  </div>
                )}
                {!isCurrent && isGrowth && (
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'#111', color:accent, border:`1px solid ${accent}55`, fontSize:10, fontWeight:900, padding:'4px 16px', borderRadius:99, whiteSpace:'nowrap' }}>
                    ⭐ MOST POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:accentBg, border:`1px solid ${accent}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                    {emoji}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color:accent, textTransform:'uppercase', letterSpacing:1 }}>{plan.name}</div>
                    <div style={{ fontSize:11, color:'#444', marginTop:1 }}>{plan.description.split('.')[0]}.</div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ marginBottom:12, paddingBottom:14, borderBottom:'1px solid #1a1a1a' }}>
                  {plan.monthly_fee === 0 ? (
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <span style={{ fontSize:38, fontWeight:900, lineHeight:1 }}>Free</span>
                      <span style={{ fontSize:12, color:'#444' }}>forever</span>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
                      <span style={{ fontSize:14, color:'#666', fontWeight:700, lineHeight:1 }}>₹</span>
                      <span style={{ fontSize:38, fontWeight:900, lineHeight:1 }}>{plan.monthly_fee.toLocaleString()}</span>
                      <span style={{ fontSize:12, color:'#444', marginLeft:2 }}>/month</span>
                    </div>
                  )}
                  <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6 }}>
                    <div style={{ background:`${accent}18`, border:`1px solid ${accent}33`, borderRadius:8, padding:'4px 10px', fontSize:12, color:accent, fontWeight:700 }}>
                      {plan.commission_rate}% commission
                    </div>
                    <div style={{ fontSize:11, color:'#444' }}>per order</div>
                  </div>
                </div>

                {/* Features */}
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 22px', display:'flex', flexDirection:'column', gap:8 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ display:'flex', gap:9, fontSize:13, color:'#aaa', alignItems:'flex-start' }}>
                      <span style={{ color:accent, flexShrink:0, fontWeight:800, fontSize:14, lineHeight:'18px' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  disabled={isCurrent || adminOverride || saving !== null}
                  onClick={() => subscribe(plan.key)}
                  style={{
                    width:'100%', padding:13, borderRadius:12, border:'none',
                    background: isCurrent
                      ? `${accent}18`
                      : isGrowth ? 'linear-gradient(135deg,#16a34a,#22C55E)' : `${accent}18`,
                    color: isCurrent ? accent : isGrowth ? '#000' : accent,
                    border: isCurrent || isGrowth ? 'none' : `1px solid ${accent}33`,
                    fontSize:14, fontWeight:800,
                    cursor: isCurrent || adminOverride ? 'default' : 'pointer',
                    opacity: saving && saving !== plan.key ? 0.45 : 1,
                    transition:'opacity 0.15s',
                  } as any}
                >
                  {saving === plan.key ? '⏳ Activating…' : isCurrent && !isTrial ? '✓ Current Plan' : isTrial ? `Upgrade to ${plan.name} →` : `Switch to ${plan.name} →`}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
