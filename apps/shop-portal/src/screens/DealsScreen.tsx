import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

interface Deal {
  id: string
  title: string
  description?: string
  deal_type: 'percent' | 'flat'
  deal_value: number
  min_order: number
  max_discount?: number
  is_active: boolean
  uses_count: number
  max_uses?: number
  valid_to?: string
  created_at: string
}

const empty = (): Omit<Deal, 'id' | 'is_active' | 'uses_count' | 'created_at'> => ({
  title: '',
  description: '',
  deal_type: 'percent',
  deal_value: 10,
  min_order: 0,
  max_discount: undefined,
  max_uses: undefined,
  valid_to: '',
})

export default function DealsScreen() {
  const { shop } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = async () => {
    if (!shop) return
    try {
      const res = await api.get(`/shops/${shop.id}/deals`)
      setDeals(res.data?.deals ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [shop?.id])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleCreate = async () => {
    if (!shop) return
    setError('')
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.valid_to) { setError('Expiry date is required'); return }
    if (form.deal_value <= 0) { setError('Discount must be > 0'); return }
    setSaving(true)
    try {
      await api.post(`/shops/${shop.id}/deals`, {
        title:        form.title.trim(),
        description:  form.description || undefined,
        deal_type:    form.deal_type,
        deal_value:   Number(form.deal_value),
        min_order:    Number(form.min_order) || 0,
        max_discount: form.max_discount ? Number(form.max_discount) : undefined,
        max_uses:     form.max_uses ? Number(form.max_uses) : undefined,
        valid_to:     form.valid_to,
      })
      setShowForm(false)
      setForm(empty())
      showToast('Deal created! 🎉')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to create deal')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (deal: Deal) => {
    if (!shop) return
    try {
      await api.patch(`/shops/${shop.id}/deals/${deal.id}`, { is_active: !deal.is_active })
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, is_active: !d.is_active } : d))
    } catch { showToast('Failed to update') }
  }

  const deleteDeal = async (id: string) => {
    if (!shop || !confirm('Delete this deal?')) return
    try {
      await api.delete(`/shops/${shop.id}/deals/${id}`)
      setDeals(prev => prev.filter(d => d.id !== id))
      showToast('Deal deleted')
    } catch { showToast('Failed to delete') }
  }

  const C = {
    card: {
      background: 'white', borderRadius: 14, padding: 20,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 12,
    } as React.CSSProperties,
    badge: (color: string) => ({
      display: 'inline-block', borderRadius: 6, padding: '3px 10px',
      fontSize: 12, fontWeight: 700, color: 'white', background: color,
    }) as React.CSSProperties,
    input: {
      width: '100%', padding: '9px 12px', borderRadius: 9,
      border: '1.5px solid #e5e7eb', fontSize: 14,
      boxSizing: 'border-box' as const, fontFamily: 'inherit',
    } as React.CSSProperties,
    label: { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' } as React.CSSProperties,
    btn: (color: string, bg: string) => ({
      padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
      background: bg, color: color, border: 'none', cursor: 'pointer',
    }) as React.CSSProperties,
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#14532d', color: 'white', padding: '12px 24px', borderRadius: 10,
          fontSize: 14, fontWeight: 600, zIndex: 9999,
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>🏷️ Local Deals</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            Create deals that auto-apply at checkout and appear in the customer app
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setError('') }} style={C.btn('white', '#FF8A00')}>
          + New Deal
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...C.card, border: '2px solid #FF8A00', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Create New Deal</h3>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#B91C1C' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={C.label}>Title *</label>
              <input style={C.input} placeholder="e.g. 10% off on orders above ₹200"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={C.label}>Description (optional)</label>
              <input style={C.input} placeholder="Extra details shown to customers"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={C.label}>Deal Type *</label>
              <select style={C.input} value={form.deal_type}
                onChange={e => setForm(f => ({ ...f, deal_type: e.target.value as any }))}>
                <option value="percent">Percentage OFF (%)</option>
                <option value="flat">Flat Amount OFF (₹)</option>
              </select>
            </div>
            <div>
              <label style={C.label}>{form.deal_type === 'percent' ? 'Discount %' : 'Discount ₹'} *</label>
              <input style={C.input} type="number" min={1} max={form.deal_type === 'percent' ? 100 : undefined}
                value={form.deal_value}
                onChange={e => setForm(f => ({ ...f, deal_value: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={C.label}>Minimum Order (₹)</label>
              <input style={C.input} type="number" min={0} placeholder="0 = no minimum"
                value={form.min_order || ''}
                onChange={e => setForm(f => ({ ...f, min_order: Number(e.target.value) }))} />
            </div>
            {form.deal_type === 'percent' && (
              <div>
                <label style={C.label}>Max Discount Cap (₹)</label>
                <input style={C.input} type="number" min={0} placeholder="Leave blank for no cap"
                  value={form.max_discount ?? ''}
                  onChange={e => setForm(f => ({ ...f, max_discount: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            )}
            <div>
              <label style={C.label}>Max Uses (total)</label>
              <input style={C.input} type="number" min={1} placeholder="Leave blank for unlimited"
                value={form.max_uses ?? ''}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div>
              <label style={C.label}>Expires At *</label>
              <input style={C.input} type="datetime-local"
                value={form.valid_to ?? ''}
                onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={handleCreate} disabled={saving} style={C.btn('white', saving ? '#ccc' : '#16a34a')}>
              {saving ? 'Saving…' : '✓ Create Deal'}
            </button>
            <button onClick={() => { setShowForm(false); setError('') }}
              style={C.btn('#555', '#f3f4f6')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Deals list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading deals…</div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 6 }}>No deals yet</div>
          <div style={{ fontSize: 13, color: '#888' }}>Create your first deal to attract more customers</div>
        </div>
      ) : deals.map(deal => (
        <div key={deal.id} style={{ ...C.card, opacity: deal.is_active ? 1 : 0.55 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={C.badge(deal.deal_type === 'percent' ? '#FF8A00' : '#7C3AED')}>
                  {deal.deal_type === 'percent' ? `${deal.deal_value}% OFF` : `₹${deal.deal_value} OFF`}
                </span>
                <span style={C.badge(deal.is_active ? '#16a34a' : '#6b7280')}>
                  {deal.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{deal.title}</div>
              {deal.description && <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{deal.description}</div>}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888' }}>
                {deal.min_order > 0 && <span>Min. ₹{deal.min_order}</span>}
                {deal.max_discount && <span>Cap ₹{deal.max_discount}</span>}
                <span>Used {deal.uses_count} times{deal.max_uses ? ` / ${deal.max_uses}` : ''}</span>
                {deal.valid_to && <span>Expires {new Date(deal.valid_to).toLocaleDateString()}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => toggleActive(deal)}
                style={C.btn(deal.is_active ? '#16a34a' : '#888', deal.is_active ? '#DCFCE7' : '#f3f4f6')}>
                {deal.is_active ? 'Pause' : 'Activate'}
              </button>
              <button onClick={() => deleteDeal(deal.id)}
                style={C.btn('#DC2626', '#FEF2F2')}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
