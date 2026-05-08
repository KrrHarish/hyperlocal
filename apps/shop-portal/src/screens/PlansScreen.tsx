import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Plan {
  key: string; name: string; monthly_fee: number; commission_rate: number
  description: string; features: string[] | string; is_active: boolean; sort_order: number
}

const ACCENT: Record<string, string> = { free: '#6B7280', growth: '#22C55E', pro: '#F59E0B' }
const ACCENT_BG: Record<string, string> = { free: 'rgba(107,114,128,0.08)', growth: 'rgba(34,197,94,0.07)', pro: 'rgba(245,158,11,0.07)' }
const PLAN_EMOJI: Record<string, string> = { free: '🌱', growth: '🚀', pro: '👑' }

const FALLBACK: Plan[] = [
  { key:'growth', name:'Growth', monthly_fee:999,  commission_rate:10, description:'For growing shops. 10% commission — Swiggy charges 22%. You keep more.', features:['Unlimited products','Advanced analytics','Priority listing','Deal promotions','Chat with customers','Phone support'], is_active:true, sort_order:2 },
  { key:'pro',    name:'Pro',    monthly_fee:2499, commission_rate:5,  description:'For high-volume shops — pharmacies, supermarkets. Industry-low 5% commission.', features:['Everything in Growth','Only 5% commission','Featured homepage placement','Dedicated account manager','Custom branding','API access'], is_active:true, sort_order:3 },
]

const COMPARE_FEATURES = [
  { label: 'Monthly fee',          values: { growth: '₹999',      pro: '₹2,499'   } },
  { label: 'Commission rate',      values: { growth: '10%',        pro: '5%'       } },
  { label: 'vs Swiggy (22%)',      values: { growth: 'Save 12%',   pro: 'Save 17%' } },
  { label: 'Products listed',      values: { growth: 'Unlimited',  pro: 'Unlimited'} },
  { label: 'Analytics',            values: { growth: 'Advanced',   pro: 'Advanced' } },
  { label: 'Priority listing',     values: { growth: true,         pro: true       } },
  { label: 'Deal promotions',      values: { growth: true,         pro: true       } },
  { label: 'Featured placement',   values: { growth: false,        pro: true       } },
  { label: 'Dedicated manager',    values: { growth: false,        pro: true       } },
  { label: 'API access',           values: { growth: false,        pro: true       } },
  { label: 'Support',              values: { growth: 'Phone',      pro: 'Priority' } },
]

const FAQS = [
  { q: 'Can I change my plan anytime?', a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
  { q: 'What counts as a commission?', a: 'Commission is charged on every completed order. Cancelled or refunded orders are excluded.' },
  { q: 'Is there a contract or lock-in?', a: 'No contracts, no lock-in. You can cancel or switch plans at the end of any billing period.' },
  { q: 'Do prices include taxes?', a: 'All prices shown are exclusive of applicable GST (18%). Tax invoice is generated every month.' },
]

function CalcSection() {
  const [gmv, setGmv] = useState(150000)
  // Compare: what you keep after commission + subscription, vs a hypothetical "no platform" scenario
  // Swiggy baseline: 22% commission, no monthly fee
  const swiggyNet = gmv - (gmv * 0.22)
  const growthNet = gmv - (gmv * 0.10) - 999
  const proNet    = gmv - (gmv * 0.05) - 2499
  const vsSwiggy_growth = growthNet - swiggyNet
  const vsSwiggy_pro    = proNet    - swiggyNet
  const proVsGrowth     = proNet    - growthNet

  return (
    <div style={{ maxWidth: 680, margin: '0 auto 0', padding: '0 24px' }}>
      <div style={{ background: '#0f1f0f', border: '1px solid #1a3a1a', borderRadius: 20, padding: '28px 28px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
            💡 EARNINGS CALCULATOR
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            How much more do you keep vs Swiggy?
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            YOUR MONTHLY GMV (ORDER VALUE)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={20000} max={1000000} step={10000} value={gmv}
              onChange={e => setGmv(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#22C55E', height: 4, cursor: 'pointer' }}
            />
            <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 14px', fontSize: 15, fontWeight: 700, color: '#fff', minWidth: 110, textAlign: 'right' }}>
              ₹{gmv.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { key: 'swiggy', label: 'Swiggy/Zomato', net: swiggyNet, badge: '22% commission', accent: '#EF4444' },
            { key: 'growth', label: 'Zuqu Growth',   net: growthNet, badge: `+₹${Math.round(vsSwiggy_growth).toLocaleString()} vs Swiggy`, accent: '#22C55E' },
            { key: 'pro',    label: 'Zuqu Pro',      net: proNet,    badge: `+₹${Math.round(vsSwiggy_pro).toLocaleString()} vs Swiggy`, accent: '#F59E0B' },
          ].map(p => (
            <div key={p.key} style={{ background: '#111', borderRadius: 12, padding: '14px 12px', border: `1px solid ${p.key !== 'swiggy' ? p.accent + '44' : '#2a1a1a'}` }}>
              <div style={{ fontSize: 11, color: p.accent, fontWeight: 700, marginBottom: 6 }}>{p.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>₹{Math.round(p.net).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>net earnings</div>
              <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: p.accent,
                background: p.accent + '15', borderRadius: 6, padding: '3px 7px', display: 'inline-block' }}>
                {p.badge}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: '#86efac', lineHeight: 1.7 }}>
          ✅ On ₹{gmv.toLocaleString()}/month, <strong>Growth keeps ₹{Math.round(vsSwiggy_growth).toLocaleString()} more</strong> than Swiggy.
          {proVsGrowth > 0 && <> <strong>Upgrading to Pro saves another ₹{Math.round(proVsGrowth).toLocaleString()}</strong>.</>}
        </div>
      </div>
    </div>
  )
}

export default function PlansScreen() {
  const navigate = useNavigate()
  const [plans, setPlans]     = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompare, setShowCompare] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    fetch('http://localhost:3000/subscription-plans')
      .then(r => r.json())
      .then(d => setPlans(d.plans?.length ? d.plans : FALLBACK))
      .catch(() => setPlans(FALLBACK))
      .finally(() => setLoading(false))
  }, [])

  const getFeatures = (f: string[] | string): string[] =>
    Array.isArray(f) ? f : (typeof f === 'string' ? JSON.parse(f) : [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Top nav */}
      <div style={{ borderBottom: '1px solid #141414', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#22C55E', letterSpacing: '-0.5px' }}>Zuqu</span>
          <span style={{ fontSize: 10, color: '#333', fontWeight: 700, letterSpacing: 1.5, marginTop: 2 }}>FOR SHOPS</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowCompare(v => !v)}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #282828', background: 'transparent', color: '#777', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {showCompare ? 'Hide' : 'Compare'} plans
          </button>
          <button onClick={() => navigate('/login')}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Sign in →
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 24px 44px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2a18', border: '1px solid #14532d', borderRadius: 99, padding: '5px 14px', fontSize: 11, color: '#22C55E', fontWeight: 700, marginBottom: 22, letterSpacing: 0.8 }}>
          <span>⚡</span> SIMPLE, TRANSPARENT PRICING
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 900, margin: '0 0 14px', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
          Grow your business.<br />
          <span style={{ color: '#22C55E' }}>Pay less as you scale.</span>
        </h1>
        <p style={{ fontSize: 16, color: '#555', maxWidth: 480, margin: '0 auto 8px', lineHeight: 1.6 }}>
          Start free, upgrade when ready. Our commission drops as you grow — that's our promise.
        </p>
        <p style={{ fontSize: 12, color: '#333', letterSpacing: 0.5 }}>
          No lock-in · Cancel anytime · Monthly billing
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 36, flexWrap: 'wrap' }}>
          {[
            { val: '2,000+', label: 'Active shops' },
            { val: '₹50Cr+', label: 'GMV processed' },
            { val: '4.8★',   label: 'Partner rating' },
          ].map(s => (
            <div key={s.val} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#444', fontWeight: 600, marginTop: 2, letterSpacing: 0.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#444', padding: 60 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          Loading plans…
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', padding: '0 24px', maxWidth: 1060, margin: '0 auto' }}>
          {plans.map(plan => {
            const accent   = ACCENT[plan.key] ?? '#22C55E'
            const accentBg = ACCENT_BG[plan.key] ?? 'rgba(34,197,94,0.07)'
            const isGrowth = plan.key === 'growth'
            const features = getFeatures(plan.features)
            const emoji    = PLAN_EMOJI[plan.key] ?? '📦'

            return (
              <div key={plan.key} style={{
                flex: '1 1 290px', maxWidth: 320,
                background: isGrowth ? '#0b1f0b' : '#0f0f0f',
                borderRadius: 22, border: `1.5px solid ${isGrowth ? accent + '55' : '#1c1c1c'}`,
                padding: '28px 24px 24px', position: 'relative',
                boxShadow: isGrowth ? `0 0 60px rgba(34,197,94,0.1), 0 0 0 1px rgba(34,197,94,0.15)` : 'none',
                transform: isGrowth ? 'translateY(-6px)' : 'none',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { if (!isGrowth) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { if (!isGrowth) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
              >
                {isGrowth && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #16a34a, #22C55E)', color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
                    ⭐ MOST POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: accentBg, border: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{plan.description.split('.')[0]}.</div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 12, paddingBottom: 16, borderBottom: '1px solid #1a1a1a' }}>
                  {plan.monthly_fee === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Free</span>
                      <span style={{ fontSize: 12, color: '#444' }}>forever</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{ fontSize: 15, color: '#666', verticalAlign: 'super', fontWeight: 700, lineHeight: 1 }}>₹</span>
                      <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{plan.monthly_fee.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: '#444', marginLeft: 2 }}>/month</span>
                    </div>
                  )}
                  {/* Commission badge */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: accent + '18', border: `1px solid ${accent}33`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: accent, fontWeight: 700 }}>
                      {plan.commission_rate}% commission
                    </div>
                    {plan.key !== 'free' && (
                      <div style={{ fontSize: 11, color: '#444' }}>per order</div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13, color: '#aaa', alignItems: 'flex-start' }}>
                      <span style={{ color: accent, flexShrink: 0, fontWeight: 800, fontSize: 14, lineHeight: '18px' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => navigate('/login', { state: { plan_key: plan.key } })}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                    background: isGrowth ? 'linear-gradient(135deg, #16a34a, #22C55E)' : `${accent}18`,
                    color: isGrowth ? '#000' : accent,
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    border: isGrowth ? 'none' : `1px solid ${accent}33`,
                    transition: 'opacity 0.15s',
                  } as any}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {plan.key === 'free' ? 'Start for free →' : `Get ${plan.name} →`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Savings Calculator */}
      <div style={{ padding: '44px 0 0' }}>
        <CalcSection />
      </div>

      {/* Comparison Table */}
      {showCompare && (
        <div style={{ maxWidth: 760, margin: '44px auto 0', padding: '0 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#555', textAlign: 'center', marginBottom: 18, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Full feature comparison
          </div>
          <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#111' }}>
              <div style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#444', letterSpacing: 1 }}>FEATURE</div>
              {['free', 'growth', 'pro'].map(k => (
                <div key={k} style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 800, color: ACCENT[k] }}>{k.toUpperCase()}</div>
              ))}
            </div>
            {COMPARE_FEATURES.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderTop: '1px solid #161616' }}>
                <div style={{ padding: '11px 18px', fontSize: 13, color: '#888' }}>{row.label}</div>
                {['free', 'growth', 'pro'].map(k => {
                  const val = (row.values as any)[k]
                  return (
                    <div key={k} style={{ padding: '11px 0', textAlign: 'center', fontSize: 12 }}>
                      {typeof val === 'boolean' ? (
                        <span style={{ color: val ? ACCENT[k] : '#333', fontSize: 16 }}>{val ? '✓' : '–'}</span>
                      ) : (
                        <span style={{ color: '#bbb', fontWeight: 600 }}>{val}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social proof */}
      <div style={{ maxWidth: 900, margin: '48px auto 0', padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 18 }}>
          WHAT SHOP OWNERS SAY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {[
            { name: 'Ravi Kumar', role: 'Grocery store, Bangalore', plan: 'growth', text: 'Switched to Growth after 2 months. Saving ₹4,200/month vs the free plan. Best business decision.' },
            { name: 'Ananya Sharma', role: 'Pharmacy, Mumbai', plan: 'pro', text: 'Pro plan with 2% commission is incredible for our volume. The dedicated manager alone is worth it.' },
            { name: 'Imran Khan', role: 'Food cloud kitchen, Delhi', plan: 'growth', text: 'The priority listing on Growth doubled our daily orders in 3 weeks. Highly recommend it.' },
          ].map((t, i) => (
            <div key={i} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 16, padding: '18px 18px 16px' }}>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7, marginBottom: 14 }}>"{t.text}"</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 99, background: ACCENT[t.plan] + '22', border: `1px solid ${ACCENT[t.plan]}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {PLAN_EMOJI[t.plan]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{t.role}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: ACCENT[t.plan], background: ACCENT[t.plan] + '15', padding: '3px 9px', borderRadius: 99 }}>
                  {t.plan.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '48px auto 0', padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 18 }}>
          FREQUENTLY ASKED
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#ccc', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
              >
                {faq.q}
                <span style={{ fontSize: 18, color: '#444', marginLeft: 12, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 18px 16px', fontSize: 13, color: '#666', lineHeight: 1.7 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', padding: '56px 24px 64px', marginTop: 8 }}>
        <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 10, letterSpacing: '-0.5px' }}>
          Ready to list your shop?
        </div>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
          Join thousands of shop owners already using Zuqu.
        </p>
        <button
          onClick={() => navigate('/login', { state: { plan_key: 'free' } })}
          style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #16a34a, #22C55E)', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginRight: 12 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Get started for free →
        </button>
        <p style={{ fontSize: 12, color: '#333', marginTop: 16 }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#22C55E', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Sign in</button>
        </p>
      </div>
    </div>
  )
}
