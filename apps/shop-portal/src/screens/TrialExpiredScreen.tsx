import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

interface Plan {
  key: string; name: string; monthly_fee: number; commission_rate: number
  description: string; features: string[] | string; is_active: boolean; sort_order: number
}

const ACCENT: Record<string, string>    = { free: '#6B7280', growth: '#22C55E', pro: '#F59E0B' }
const ACCENT_BG: Record<string, string> = { free: 'rgba(107,114,128,0.08)', growth: 'rgba(34,197,94,0.07)', pro: 'rgba(245,158,11,0.07)' }
const PLAN_EMOJI: Record<string, string> = { free: '🌱', growth: '🚀', pro: '👑' }
const API = 'http://localhost:3000'
// Token lives in sessionStorage (not localStorage) while user is blocked — they're not "logged in"
const subscribeToken = () => sessionStorage.getItem('zuqu_subscribe_token') ?? ''

const FALLBACK: Plan[] = [
  { key:'growth', name:'Growth', monthly_fee:999,  commission_rate:10, description:'For growing shops. 10% commission — Swiggy charges 22%. You keep more.', features:['Unlimited products','Advanced analytics','Priority listing','Deal promotions','Chat with customers','Phone support'], is_active:true, sort_order:2 },
  { key:'pro',    name:'Pro',    monthly_fee:2499, commission_rate:5,  description:'For high-volume shops — pharmacies, supermarkets. Industry-low 5% commission.', features:['Everything in Growth','Only 5% commission','Featured homepage placement','Dedicated account manager','Custom branding','API access'], is_active:true, sort_order:3 },
]

const BLOCKED_FEATURES = [
  'Dashboard & analytics', 'Order management',
  'Product catalogue',     'Customer messages',
  'Deal promotions',       'Shop open/close toggle',
]

export default function TrialExpiredScreen() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [plans, setPlans]       = useState<Plan[]>([])
  const [saving, setSaving]     = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [shopName, setShopName] = useState<string>('')
  const [isTrial, setIsTrial]   = useState(true)

  const tk = subscribeToken()
  const hasToken = !!tk

  useEffect(() => {
    // Load plan options (public endpoint — no auth needed)
    fetch(`${API}/subscription-plans`)
      .then(r => r.json())
      .then(d => {
        const paid = (d.plans ?? FALLBACK).filter((p: Plan) => p.monthly_fee > 0)
        setPlans(paid.length ? paid : FALLBACK)
      })
      .catch(() => setPlans(FALLBACK))

    // Use sessionStorage token to fetch context (trial vs expired paid + shop name)
    if (tk) {
      Promise.allSettled([
        fetch(`${API}/shop-portal/subscription`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json()),
        fetch(`${API}/shops/my`,                 { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json()),
      ]).then(([subRes, shopRes]) => {
        if (subRes.status === 'fulfilled') setIsTrial(!!subRes.value.is_trial)
        if (shopRes.status === 'fulfilled') setShopName(shopRes.value.shops?.[0]?.name ?? '')
      }).catch(() => {})
    }
  }, [])

  const getFeatures = (f: string[] | string): string[] =>
    Array.isArray(f) ? f : (typeof f === 'string' ? JSON.parse(f) : [])

  const subscribe = async (planKey: string) => {
    if (!hasToken) { navigate('/login', { replace: true }); return }
    setSaving(planKey); setError('')
    try {
      const res = await fetch(`${API}/shop-portal/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ plan_key: planKey }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      // Subscription active — move token from sessionStorage → localStorage (proper login)
      sessionStorage.removeItem('zuqu_subscribe_token')
      await login(tk)
      navigate('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSaving(null)
    }
  }

  const logout = () => {
    sessionStorage.removeItem('zuqu_subscribe_token')
    localStorage.removeItem('zuqu_owner_token')
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>

      {/* Top bar */}
      <div style={{ width: '100%', borderBottom: '1px solid #141414', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#22C55E', letterSpacing: '-0.5px' }}>Zuqu</span>
          <span style={{ fontSize: 10, color: '#2a2a2a', fontWeight: 700, letterSpacing: 1.5 }}>SHOP PORTAL</span>
          {shopName && (
            <>
              <span style={{ color: '#222', fontSize: 14 }}>·</span>
              <span style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>{shopName}</span>
            </>
          )}
        </div>
        <button onClick={logout} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #282828', background: 'transparent', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '52px 24px 36px', maxWidth: 580, position: 'relative' }}>
        {/* bg glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 420, height: 220, background: 'radial-gradient(ellipse, rgba(239,68,68,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Icon */}
        <div style={{ width: 76, height: 76, borderRadius: 22, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 24px' }}>
          ⏰
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a0808', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 99, padding: '4px 14px', fontSize: 11, color: '#f87171', fontWeight: 700, marginBottom: 20, letterSpacing: 0.8 }}>
          {isTrial ? 'FREE TRIAL ENDED' : 'SUBSCRIPTION EXPIRED'}
        </div>

        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 14px', letterSpacing: '-1px', lineHeight: 1.1 }}>
          {isTrial ? (
            <>Your 30-day free trial<br />has ended</>
          ) : (
            <>Your subscription<br />has expired</>
          )}
        </h1>
        <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, margin: '0 0 6px' }}>
          {isTrial
            ? 'Your trial period is over. Choose a plan below to continue running your shop on Zuqu.'
            : 'Your subscription lapsed. Renew now to restore full access to your shop dashboard.'}
        </p>
        <p style={{ fontSize: 12, color: '#2e2e2e' }}>Instant activation · No lock-in · Cancel anytime</p>
      </div>

      {/* What's blocked */}
      <div style={{ maxWidth: 560, width: '100%', padding: '0 24px', boxSizing: 'border-box', marginBottom: 32 }}>
        <div style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3a3a3a', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
            Currently blocked
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            {BLOCKED_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444' }}>
                <span style={{ color: '#7f1d1d', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>✕</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 760, width: '100%', padding: '0 24px 16px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#f87171' }}>{error}</div>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', padding: '0 24px 32px', maxWidth: 820, width: '100%', boxSizing: 'border-box' }}>
        {plans.map(plan => {
          const accent   = ACCENT[plan.key] ?? '#22C55E'
          const accentBg = ACCENT_BG[plan.key] ?? 'rgba(34,197,94,0.07)'
          const isGrowth = plan.key === 'growth'
          const features = getFeatures(plan.features)
          const emoji    = PLAN_EMOJI[plan.key] ?? '📦'

          return (
            <div key={plan.key} style={{
              flex: '1 1 280px', maxWidth: 350,
              background: isGrowth ? '#091a09' : '#0d0d0d',
              borderRadius: 22,
              border: `1.5px solid ${isGrowth ? accent + '44' : '#1c1c1c'}`,
              padding: '30px 26px 26px', position: 'relative',
              boxShadow: isGrowth ? `0 0 60px rgba(34,197,94,0.08)` : 'none',
              transform: isGrowth ? 'translateY(-4px)' : 'none',
            }}>
              {isGrowth && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#15803d,#22C55E)', color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 18px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
                  ⭐ RECOMMENDED
                </div>
              )}

              {/* Plan name + icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: accentBg, border: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {emoji}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>{plan.name}</div>
                  <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 1 }}>{plan.description.split('.')[0]}.</div>
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #181818' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 15, color: '#555', fontWeight: 700 }}>₹</span>
                  <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{plan.monthly_fee.toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: '#3a3a3a', marginLeft: 3 }}>/month</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', background: `${accent}15`, border: `1px solid ${accent}30`, borderRadius: 8, padding: '4px 11px', fontSize: 12, color: accent, fontWeight: 700 }}>
                    {plan.commission_rate}% commission per order
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13, color: '#888', alignItems: 'flex-start' }}>
                    <span style={{ color: accent, flexShrink: 0, fontWeight: 900, lineHeight: '19px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => subscribe(plan.key)}
                disabled={saving !== null}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12,
                  background: isGrowth ? 'linear-gradient(135deg,#15803d,#22C55E)' : `${accent}15`,
                  color: isGrowth ? '#000' : accent,
                  border: isGrowth ? 'none' : `1px solid ${accent}30`,
                  fontSize: 14, fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving && saving !== plan.key ? 0.4 : 1,
                  transition: 'opacity 0.15s, transform 0.1s',
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.opacity = saving && saving !== plan.key ? '0.4' : '1' }}
              >
                {saving === plan.key
                  ? '⏳ Activating…'
                  : isTrial
                    ? `Start ${plan.name} plan →`
                    : `Renew with ${plan.name} →`}
              </button>
            </div>
          )
        })}
      </div>

      {/* No session token warning */}
      {!hasToken && (
        <div style={{ maxWidth: 560, width: '100%', padding: '0 24px 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1a1200', border: '1px solid #854d0e', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#fbbf24', textAlign: 'center', lineHeight: 1.7 }}>
            ⚠️ Session expired. Please{' '}
            <button onClick={() => navigate('/login', { replace: true })} style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>
              log in again
            </button>
            {' '}to choose a plan.
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '0 24px 52px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#2e2e2e', lineHeight: 2 }}>
          Questions?{' '}
          <a href="mailto:support@zuqu.in" style={{ color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>support@zuqu.in</a>
          {' · '}
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Sign out and log in with a different account
          </button>
        </p>
      </div>
    </div>
  )
}
