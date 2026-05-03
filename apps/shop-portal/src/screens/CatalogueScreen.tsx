import { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

type StockStatus = 'in_stock' | 'low' | 'out_of_stock'

interface ShopProduct {
  id: string
  master_product_id: string
  name: string
  brand: string
  category: string
  unit: string
  emoji: string
  price: string
  stock_status: StockStatus
}

interface MasterProduct {
  id: string
  name: string
  brand: string
  category: string
  unit: string
  emoji: string
}

const STOCK_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in_stock',     label: '● In Stock'     },
  { value: 'low',          label: '◐ Low Stock'    },
  { value: 'out_of_stock', label: '○ Out of Stock' },
]

const STOCK_COLOR: Record<StockStatus, string> = {
  in_stock:     'var(--green-600)',
  low:          'var(--yellow)',
  out_of_stock: 'var(--red)',
}

export default function CatalogueScreen() {
  const { shop } = useAuth()
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Add product modal state
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MasterProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<MasterProduct | null>(null)
  const [price, setPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    if (shop) fetchProducts()
  }, [shop])

  const fetchProducts = async () => {
    if (!shop) return
    setLoading(true)
    try {
      const res = await api.get(`/shops/${shop.id}/products`)
      setProducts(res.data.products ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const updateStock = async (productId: string, status: StockStatus) => {
    if (!shop) return
    setUpdatingId(productId)
    try {
      await api.patch(`/shops/${shop.id}/products/${productId}/stock`, { status })
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, stock_status: status } : p)
      )
      setSavedId(productId)
      setTimeout(() => setSavedId(null), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingId(null)
    }
  }

  // Debounced master catalog search
  const handleSearchChange = (q: string) => {
    setQuery(q)
    setSelected(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`)
        setSearchResults(res.data.products ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  const handleAddProduct = async () => {
    if (!shop || !selected || !price) return
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) { setAddError('Enter a valid price'); return }
    setAdding(true)
    setAddError('')
    try {
      await api.post(`/shops/${shop.id}/products`, {
        master_product_id: selected.id,
        price: p,
      })
      await fetchProducts()
      setShowAdd(false)
      setQuery(''); setSearchResults([]); setSelected(null); setPrice('')
    } catch (e: any) {
      setAddError(e?.response?.data?.error ?? 'Failed to add product')
    } finally {
      setAdding(false)
    }
  }

  const closeModal = () => {
    setShowAdd(false)
    setQuery(''); setSearchResults([]); setSelected(null); setPrice(''); setAddError('')
  }

  // Group by category
  const grouped = products.reduce<Record<string, ShopProduct[]>>((acc, p) => {
    const cat = p.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Catalogue</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
            {products.length} product{products.length !== 1 ? 's' : ''} listed
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ padding: '9px 18px' }}>
          + Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No products yet</div>
          <div style={{ color: 'var(--gray-400)', marginBottom: 20 }}>Add products from the master catalogue to start selling</div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Your First Product</button>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              {category}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {items.map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px' }}>
                  <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>
                    {p.emoji ?? '🛒'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
                      {[p.brand, p.unit].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--green-700)' }}>
                        ₹{parseFloat(p.price).toFixed(0)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {savedId === p.id && (
                          <span style={{ fontSize: 11, color: 'var(--green-600)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            ✓ Saved
                          </span>
                        )}
                        {updatingId === p.id && (
                          <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                        )}
                        <select
                          value={p.stock_status}
                          onChange={e => updateStock(p.id, e.target.value as StockStatus)}
                          disabled={updatingId === p.id}
                          style={{
                            border: '1.5px solid var(--gray-200)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 600,
                            color: STOCK_COLOR[p.stock_status],
                            cursor: updatingId === p.id ? 'not-allowed' : 'pointer',
                            background: 'white',
                            outline: 'none',
                          }}
                        >
                          {STOCK_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add Product Modal */}
      {showAdd && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 14,
              padding: 28,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Add Product</div>
              <button onClick={closeModal} style={{ background: 'none', fontSize: 20, color: 'var(--gray-400)', lineHeight: 1 }}>✕</button>
            </div>

            {!selected ? (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
                  Search master catalogue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amul Butter, Tata Salt…"
                  value={query}
                  onChange={e => handleSearchChange(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1.5px solid var(--gray-200)',
                    borderRadius: 8,
                    fontSize: 14,
                    outline: 'none',
                    marginBottom: 12,
                  }}
                />
                {searching && (
                  <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 16 }}>
                    <div className="spinner" />
                  </div>
                )}
                {!searching && searchResults.length > 0 && (
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
                    {searchResults.map((mp, i) => (
                      <div
                        key={mp.id}
                        onClick={() => setSelected(mp)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <span style={{ fontSize: 24 }}>{mp.emoji ?? '🛒'}</span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{mp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                            {[mp.brand, mp.unit, mp.category].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!searching && query.length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 16, fontSize: 13 }}>
                    No results found for "{query}"
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected product preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: 'var(--green-50)',
                  border: '1.5px solid var(--green-200)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 20,
                }}>
                  <span style={{ fontSize: 32 }}>{selected.emoji ?? '🛒'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {[selected.brand, selected.unit].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setPrice('') }} style={{ background: 'none', color: 'var(--gray-400)', fontSize: 18 }}>✕</button>
                </div>

                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
                  Your selling price (₹)
                </label>
                <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
                  <span style={{
                    padding: '10px 14px',
                    background: 'var(--gray-100)',
                    border: '1.5px solid var(--gray-200)',
                    borderRight: 'none',
                    borderRadius: '8px 0 0 8px',
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                  }}>₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                    autoFocus
                    min={1}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      border: '1.5px solid var(--gray-200)',
                      borderRadius: '0 8px 8px 0',
                      fontSize: 18,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {addError && (
                  <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '10px 12px', background: 'var(--red-light)', borderRadius: 8 }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-outline" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                  <button
                    className="btn-primary"
                    onClick={handleAddProduct}
                    disabled={adding || !price}
                    style={{ flex: 2 }}
                  >
                    {adding ? 'Adding…' : 'Add to Catalogue →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
