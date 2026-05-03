import { useEffect, useState, useRef, useCallback } from 'react'
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
  price: string
  stock_status: StockStatus
  image_url?: string
  custom_image_url?: string
}

interface MasterProduct {
  id: string
  name: string
  brand: string
  category: string
  unit: string
  emoji: string
}

const STOCK_OPTIONS: { value: StockStatus; label: string; color: string; bg: string }[] = [
  { value: 'in_stock',     label: 'In Stock',     color: '#16A34A', bg: '#DCFCE7' },
  { value: 'low',          label: 'Low Stock',    color: '#D97706', bg: '#FEF3C7' },
  { value: 'out_of_stock', label: 'Out of Stock', color: '#DC2626', bg: '#FEE2E2' },
]

const BASE_URL = 'http://localhost:3000'

function productEmoji(name: string, category: string): string {
  const n = name.toLowerCase()
  if (n.includes('milk'))     return '🥛'; if (n.includes('butter'))  return '🧈'
  if (n.includes('curd'))     return '🥣'; if (n.includes('cheese'))  return '🧀'
  if (n.includes('bread'))    return '🍞'; if (n.includes('rice'))    return '🍚'
  if (n.includes('atta'))     return '🌾'; if (n.includes('dal'))     return '🫘'
  if (n.includes('oil'))      return '🫒'; if (n.includes('salt'))    return '🧂'
  if (n.includes('sugar'))    return '🍬'; if (n.includes('maggi'))   return '🍜'
  if (n.includes('biscuit') || n.includes('parle')) return '🍪'
  if (n.includes('chips') || n.includes('lays'))    return '🍿'
  if (n.includes('juice') || n.includes('tropicana')) return '🧃'
  if (n.includes('cola') || n.includes('pepsi'))    return '🥤'
  if (n.includes('soap') || n.includes('dettol'))   return '🧼'
  if (n.includes('shampoo'))  return '🧴'; if (n.includes('toothpaste')) return '🪥'
  if (n.includes('detergent') || n.includes('surf')) return '🧺'
  if (n.includes('tea'))      return '🍵'; if (n.includes('coffee'))  return '☕'
  const map: Record<string, string> = { grocery:'🛒', dairy:'🥛', snacks:'🍿', beverages:'🧃', personal_care:'🧴', household:'🧹', bakery:'🍞', pharmacy:'💊' }
  return map[category?.toLowerCase()] || '🛒'
}

function stockMeta(status: StockStatus) {
  return STOCK_OPTIONS.find(o => o.value === status) ?? STOCK_OPTIONS[0]
}

export default function CatalogueScreen() {
  const { shop } = useAuth()
  const [products, setProducts]     = useState<ShopProduct[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // ── Edit modal
  const [editProduct, setEditProduct] = useState<ShopProduct | null>(null)
  const [editName, setEditName]       = useState('')
  const [editBrand, setEditBrand]     = useState('')
  const [editUnit, setEditUnit]       = useState('')
  const [editPrice, setEditPrice]     = useState('')
  const [editStock, setEditStock]     = useState<StockStatus>('in_stock')
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')
  const [imgPreview, setImgPreview]   = useState<string | null>(null)
  const [imgFile, setImgFile]         = useState<File | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  // ── Add product modal
  const [showAdd, setShowAdd]           = useState(false)
  const [addTab, setAddTab]             = useState<'search'|'custom'>('search')
  // search tab
  const [query, setQuery]               = useState('')
  const [searchResults, setSearchResults] = useState<MasterProduct[]>([])
  const [searching, setSearching]       = useState(false)
  const [selected, setSelected]         = useState<MasterProduct | null>(null)
  const [addPrice, setAddPrice]         = useState('')
  const [adding, setAdding]             = useState(false)
  const [addError, setAddError]         = useState('')
  const searchTimer = useRef<number | null>(null)
  // custom tab
  const [customName, setCustomName]     = useState('')
  const [customBrand, setCustomBrand]   = useState('')
  const [customCategory, setCustomCategory] = useState('grocery')
  const [customUnit, setCustomUnit]     = useState('')
  const [customPrice, setCustomPrice]   = useState('')
  const [customAdding, setCustomAdding] = useState(false)
  const [customError, setCustomError]   = useState('')
  const [customImgFile, setCustomImgFile]     = useState<File | null>(null)
  const [customImgPreview, setCustomImgPreview] = useState<string | null>(null)
  const customImgRef = useRef<HTMLInputElement>(null)

  // ── Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (shop) fetchProducts() }, [shop])

  const fetchProducts = async () => {
    if (!shop) return
    setLoading(true)
    try {
      const res = await api.get(`/shops/${shop.id}/products`)
      setProducts(res.data.products ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── Open edit modal
  const openEdit = (p: ShopProduct) => {
    setEditProduct(p)
    setEditName(p.name)
    setEditBrand(p.brand || '')
    setEditUnit(p.unit || '')
    setEditPrice(parseFloat(p.price).toFixed(0))
    setEditStock(p.stock_status)
    setImgPreview(null)
    setImgFile(null)
    setEditError('')
  }

  const closeEdit = () => { setEditProduct(null); setImgPreview(null); setImgFile(null) }

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
  }

  const saveEdit = async () => {
    if (!shop || !editProduct) return
    if (!editName.trim()) { setEditError('Product name cannot be empty'); return }
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) { setEditError('Enter a valid price'); return }
    setEditSaving(true); setEditError('')
    try {
      // 1. Update name, brand, unit, price
      await api.patch(`/shops/${shop.id}/products/${editProduct.id}`, {
        price,
        name: editName.trim(),
        brand: editBrand.trim() || undefined,
        unit: editUnit.trim() || undefined,
      })
      // 2. Update stock if changed
      if (editStock !== editProduct.stock_status) {
        await api.patch(`/shops/${shop.id}/products/${editProduct.id}/stock`, { status: editStock })
      }
      // 3. Upload image if changed
      let newImageUrl = editProduct.custom_image_url
      if (imgFile) {
        const form = new FormData()
        form.append('file', imgFile)
        const res = await api.post(`/shops/${shop.id}/products/${editProduct.id}/image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newImageUrl = res.data.image_url
      }
      // 4. Update local state
      setProducts(prev => prev.map(p =>
        p.id === editProduct.id
          ? { ...p, name: editName.trim(), brand: editBrand.trim(), unit: editUnit.trim(), price: String(price), stock_status: editStock, custom_image_url: newImageUrl }
          : p
      ))
      closeEdit()
    } catch (e: any) {
      setEditError(e?.response?.data?.error ?? 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete / hide product
  const confirmDelete = async () => {
    if (!shop || !deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/shops/${shop.id}/products/${deleteId}`)
      setProducts(prev => prev.filter(p => p.id !== deleteId))
      setDeleteId(null)
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  // ── Add product modal
  const handleSearchChange = (q: string) => {
    setQuery(q); setSelected(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`)
        setSearchResults(res.data.products ?? [])
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 350)
  }

  const handleAddProduct = async () => {
    if (!shop || !selected || !addPrice) return
    const p = parseFloat(addPrice)
    if (isNaN(p) || p <= 0) { setAddError('Enter a valid price'); return }
    setAdding(true); setAddError('')
    try {
      await api.post(`/shops/${shop.id}/products`, { master_product_id: selected.id, price: p })
      await fetchProducts()
      closeAddModal()
    } catch (e: any) {
      setAddError(e?.response?.data?.error ?? 'Failed to add product')
    } finally { setAdding(false) }
  }

  const handleAddCustomProduct = async () => {
    if (!shop || !customName.trim() || !customPrice) return
    const p = parseFloat(customPrice)
    if (isNaN(p) || p <= 0) { setCustomError('Enter a valid price'); return }
    setCustomAdding(true); setCustomError('')
    try {
      const res = await api.post(`/shops/${shop.id}/products/custom`, {
        name: customName.trim(), brand: customBrand.trim() || undefined,
        category: customCategory, unit: customUnit.trim() || undefined, price: p,
      })
      // Upload image if one was selected
      if (customImgFile && res.data.product?.id) {
        const form = new FormData()
        form.append('file', customImgFile)
        await api.post(`/shops/${shop.id}/products/${res.data.product.id}/image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      await fetchProducts()
      closeAddModal()
    } catch (e: any) {
      setCustomError(e?.response?.data?.error ?? 'Failed to add product')
    } finally { setCustomAdding(false) }
  }

  const closeAddModal = () => {
    setShowAdd(false); setAddTab('search')
    setQuery(''); setSearchResults([]); setSelected(null); setAddPrice(''); setAddError('')
    setCustomName(''); setCustomBrand(''); setCustomCategory('grocery')
    setCustomUnit(''); setCustomPrice(''); setCustomError('')
    setCustomImgFile(null); setCustomImgPreview(null)
  }

  // ── Filter
  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, ShopProduct[]>>((acc, p) => {
    const cat = p.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, gap:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Catalogue</h1>
          <p style={{ fontSize:13, color:'var(--gray-400)', marginTop:2 }}>
            {products.length} product{products.length !== 1 ? 's' : ''} listed
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)', fontSize:14 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              style={{
                paddingLeft:32, paddingRight:12, paddingTop:8, paddingBottom:8,
                border:'1.5px solid var(--gray-200)', borderRadius:8, fontSize:13,
                outline:'none', width:200,
              }}
            />
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ padding:'9px 20px', whiteSpace:'nowrap' }}>
            + Add Product
          </button>
        </div>
      </div>

      {/* ── Product list grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
          <div style={{ fontWeight:600, fontSize:16, marginBottom:8 }}>No products yet</div>
          <div style={{ color:'var(--gray-400)', marginBottom:20 }}>Add products from the master catalogue to start selling</div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Your First Product</button>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom:32 }}>
            <div style={{
              fontSize:11, fontWeight:800, color:'var(--gray-500)',
              textTransform:'uppercase', letterSpacing:'1px',
              marginBottom:12, display:'flex', alignItems:'center', gap:8,
            }}>
              <div style={{ flex:1, height:1, background:'var(--gray-100)' }} />
              {category}
              <div style={{ flex:1, height:1, background:'var(--gray-100)' }} />
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:0, borderRadius:14, overflow:'hidden', border:'1px solid var(--gray-100)', background:'white', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
              {items.map((p, i) => {
                const sm = stockMeta(p.stock_status)
                const imageUrl = p.custom_image_url
                  ? `${BASE_URL}${p.custom_image_url}`
                  : p.image_url || null

                return (
                  <div
                    key={p.id}
                    style={{
                      display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                      borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none',
                      transition:'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    {/* Image / emoji */}
                    <div style={{
                      width:56, height:56, borderRadius:12, overflow:'hidden', flexShrink:0,
                      background:'#FFF4E6', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:28, border:'1px solid var(--gray-100)',
                    }}>
                      {imageUrl
                        ? <img src={imageUrl} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
                        : productEmoji(p.name, p.category)
                      }
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:'#111', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                        {[p.brand, p.unit].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ fontWeight:800, fontSize:16, color:'#111', minWidth:60, textAlign:'right' }}>
                      ₹{parseFloat(p.price).toFixed(0)}
                    </div>

                    {/* Stock badge */}
                    <div style={{
                      background:sm.bg, color:sm.color,
                      fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99,
                      whiteSpace:'nowrap', minWidth:90, textAlign:'center',
                    }}>
                      {sm.label}
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button
                        onClick={() => openEdit(p)}
                        title="Edit product"
                        style={{
                          width:34, height:34, borderRadius:8,
                          border:'1.5px solid var(--gray-200)', background:'white',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          cursor:'pointer', fontSize:15, transition:'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--gray-50)'; e.currentTarget.style.borderColor='var(--gray-300)' }}
                        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='var(--gray-200)' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        title="Remove from catalogue"
                        style={{
                          width:34, height:34, borderRadius:8,
                          border:'1.5px solid #FEE2E2', background:'white',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          cursor:'pointer', fontSize:15, transition:'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.borderColor='#FECACA' }}
                        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#FEE2E2' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}


      {/* ════════════════════════════════════════
          EDIT PRODUCT MODAL
      ════════════════════════════════════════ */}
      {editProduct && (
        <div
          onClick={closeEdit}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'white', borderRadius:18, width:'100%', maxWidth:480,
              boxShadow:'0 24px 80px rgba(0,0,0,0.18)', overflow:'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>Edit Product</div>
                <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>{editProduct.name}</div>
              </div>
              <button onClick={closeEdit} style={{ background:'none', fontSize:20, color:'var(--gray-400)', lineHeight:1, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ padding:'20px 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>

              {/* Image upload */}
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:10 }}>
                  Product Image
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  {/* Preview */}
                  <div
                    style={{
                      width:80, height:80, borderRadius:14, overflow:'hidden', flexShrink:0,
                      background:'#FFF4E6', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:36, border:'2px dashed var(--gray-200)', cursor:'pointer', position:'relative',
                    }}
                    onClick={() => imgInputRef.current?.click()}
                  >
                    {imgPreview ? (
                      <img src={imgPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : editProduct.custom_image_url ? (
                      <img src={`${BASE_URL}${editProduct.custom_image_url}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      productEmoji(editProduct.name, editProduct.category)
                    )}
                    <div style={{
                      position:'absolute', inset:0, background:'rgba(0,0,0,0.3)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity:0, transition:'opacity 0.15s', borderRadius:12,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >
                      <span style={{ color:'white', fontSize:20 }}>📷</span>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      style={{
                        padding:'8px 16px', border:'1.5px solid var(--gray-200)', borderRadius:8,
                        background:'white', fontSize:13, fontWeight:600, cursor:'pointer', display:'block', marginBottom:6,
                      }}
                    >
                      📁 Choose Photo
                    </button>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>JPG, PNG or WebP · Max 5 MB</div>
                  </div>
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display:'none' }}
                    onChange={handleImagePick}
                  />
                </div>
              </div>

              {/* Product name */}
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>
                  Product Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:8, fontSize:14, fontWeight:600, outline:'none', boxSizing:'border-box' }}
                />
              </div>

              {/* Brand + Unit */}
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>Brand</label>
                  <input
                    type="text" value={editBrand} onChange={e => setEditBrand(e.target.value)}
                    placeholder="e.g. Tata"
                    style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>Unit / Size</label>
                  <input
                    type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)}
                    placeholder="e.g. 250g"
                    style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>
                  Selling Price (₹)
                </label>
                <div style={{ display:'flex' }}>
                  <span style={{ padding:'10px 14px', background:'var(--gray-100)', border:'1.5px solid var(--gray-200)', borderRight:'none', borderRadius:'8px 0 0 8px', fontWeight:600, color:'var(--gray-500)' }}>₹</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    min={1}
                    autoFocus
                    style={{ flex:1, padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:'0 8px 8px 0', fontSize:18, fontWeight:700, outline:'none' }}
                  />
                </div>
              </div>

              {/* Stock status */}
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:10 }}>
                  Stock Status
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  {STOCK_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditStock(opt.value)}
                      style={{
                        flex:1, padding:'9px 4px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                        border: editStock === opt.value ? `2px solid ${opt.color}` : '1.5px solid var(--gray-200)',
                        background: editStock === opt.value ? opt.bg : 'white',
                        color: editStock === opt.value ? opt.color : 'var(--gray-500)',
                        transition:'all 0.12s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {editError && (
                <div style={{ color:'var(--red)', fontSize:13, padding:'10px 12px', background:'var(--red-light)', borderRadius:8 }}>
                  {editError}
                </div>
              )}

              {/* Footer buttons */}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button className="btn-outline" onClick={closeEdit} style={{ flex:1 }}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={saveEdit}
                  disabled={editSaving}
                  style={{ flex:2 }}
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════
          DELETE CONFIRM MODAL
      ════════════════════════════════════════ */}
      {deleteId && (
        <div
          onClick={() => setDeleteId(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:16, padding:28, width:'100%', maxWidth:360, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', textAlign:'center' }}
          >
            <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Remove Product?</div>
            <div style={{ color:'var(--gray-400)', fontSize:13, marginBottom:24 }}>
              This product will be hidden from customers. You can add it back anytime.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-outline" onClick={() => setDeleteId(null)} style={{ flex:1 }}>Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ flex:1, padding:'10px 0', borderRadius:8, background:'#DC2626', color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════
          ADD PRODUCT MODAL
      ════════════════════════════════════════ */}
      {showAdd && (
        <div
          onClick={closeAddModal}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:18, width:'100%', maxWidth:520, boxShadow:'0 24px 80px rgba(0,0,0,0.2)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}
          >
            {/* Modal header */}
            <div style={{ padding:'20px 24px 0', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:17 }}>Add Product</div>
                <button onClick={closeAddModal} style={{ background:'none', fontSize:20, color:'var(--gray-400)', lineHeight:1, cursor:'pointer' }}>✕</button>
              </div>

              {/* Tab switcher */}
              <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:10, padding:4, marginBottom:20 }}>
                {([['search','🔍 Search Catalogue'],['custom','✏️ Custom Product']] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setAddTab(tab)}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:7, border:'none', fontSize:13,
                      fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                      background: addTab === tab ? 'white' : 'transparent',
                      color: addTab === tab ? '#111' : 'var(--gray-400)',
                      boxShadow: addTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ padding:'0 24px 24px', overflowY:'auto', flex:1 }}>

              {/* ── SEARCH TAB */}
              {addTab === 'search' && (
                <>
                  {!selected ? (
                    <>
                      <div style={{ position:'relative', marginBottom:12 }}>
                        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🔍</span>
                        <input
                          type="text"
                          placeholder="Search by name or brand…  e.g. Amul Butter"
                          value={query}
                          onChange={e => handleSearchChange(e.target.value)}
                          autoFocus
                          style={{ width:'100%', padding:'11px 14px 11px 38px', border:'1.5px solid var(--gray-200)', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}
                        />
                      </div>
                      {searching && <div style={{ textAlign:'center', padding:24 }}><div className="spinner" /></div>}
                      {!searching && searchResults.length > 0 && (
                        <div style={{ border:'1px solid var(--gray-200)', borderRadius:10, overflow:'hidden' }}>
                          {searchResults.map((mp, i) => (
                            <div
                              key={mp.id}
                              onClick={() => setSelected(mp)}
                              style={{ padding:'12px 16px', cursor:'pointer', borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none', display:'flex', alignItems:'center', gap:12, transition:'background 0.1s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                            >
                              <div style={{ width:40, height:40, borderRadius:10, background:'#FFF4E6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                                {productEmoji(mp.name, mp.category)}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:600, fontSize:14, color:'#111' }}>{mp.name}</div>
                                <div style={{ fontSize:12, color:'var(--gray-400)' }}>{[mp.brand, mp.unit, mp.category].filter(Boolean).join(' · ')}</div>
                              </div>
                              <span style={{ color:'var(--gray-300)', fontSize:18 }}>›</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!searching && query.length >= 2 && searchResults.length === 0 && (
                        <div style={{ textAlign:'center', padding:24 }}>
                          <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                          <div style={{ fontSize:14, color:'var(--gray-500)', fontWeight:600, marginBottom:4 }}>No results for "{query}"</div>
                          <div style={{ fontSize:12, color:'var(--gray-400)' }}>Try the Custom Product tab to add it manually</div>
                        </div>
                      )}
                      {!query && (
                        <div style={{ textAlign:'center', padding:24, color:'var(--gray-400)', fontSize:13 }}>
                          Type at least 2 characters to search
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Selected product preview */}
                      <div style={{ display:'flex', alignItems:'center', gap:14, background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                        <div style={{ width:48, height:48, borderRadius:12, background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                          {productEmoji(selected.name, selected.category)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:2 }}>{selected.name}</div>
                          <div style={{ fontSize:12, color:'#4B5563' }}>{[selected.brand, selected.unit, selected.category].filter(Boolean).join(' · ')}</div>
                        </div>
                        <button onClick={() => { setSelected(null); setAddPrice('') }} style={{ background:'none', color:'#9CA3AF', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
                      </div>

                      <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>Your selling price (₹)</label>
                      <div style={{ display:'flex', marginBottom:16 }}>
                        <span style={{ padding:'11px 14px', background:'var(--gray-100)', border:'1.5px solid var(--gray-200)', borderRight:'none', borderRadius:'10px 0 0 10px', fontWeight:700, color:'var(--gray-500)', fontSize:16 }}>₹</span>
                        <input
                          type="number" placeholder="0" value={addPrice}
                          onChange={e => setAddPrice(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                          autoFocus min={1}
                          style={{ flex:1, padding:'11px 14px', border:'1.5px solid var(--gray-200)', borderRadius:'0 10px 10px 0', fontSize:20, fontWeight:700, outline:'none' }}
                        />
                      </div>

                      {addError && <div style={{ color:'var(--red)', fontSize:13, marginBottom:14, padding:'10px 12px', background:'#FEF2F2', borderRadius:8 }}>{addError}</div>}

                      <div style={{ display:'flex', gap:10 }}>
                        <button className="btn-outline" onClick={closeAddModal} style={{ flex:1 }}>Cancel</button>
                        <button className="btn-primary" onClick={handleAddProduct} disabled={adding || !addPrice} style={{ flex:2 }}>
                          {adding ? 'Adding…' : 'Add to Catalogue →'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── CUSTOM PRODUCT TAB */}
              {addTab === 'custom' && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#1E40AF' }}>
                    💡 Use this to add products not found in the catalogue — like homemade items or local brands.
                  </div>

                  {/* Image upload */}
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>
                      Product Image <span style={{ fontWeight:400, color:'var(--gray-400)' }}>(optional)</span>
                    </label>
                    <div
                      onClick={() => customImgRef.current?.click()}
                      style={{
                        border: customImgPreview ? '2px solid #22C55E' : '2px dashed var(--gray-200)',
                        borderRadius:12, padding: customImgPreview ? 0 : '20px 0',
                        cursor:'pointer', textAlign:'center', overflow:'hidden',
                        background: customImgPreview ? 'transparent' : '#FAFAFA',
                        height: customImgPreview ? 160 : 'auto',
                        position:'relative', transition:'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!customImgPreview) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => { if (!customImgPreview) e.currentTarget.style.background = '#FAFAFA' }}
                    >
                      {customImgPreview ? (
                        <>
                          <img src={customImgPreview} style={{ width:'100%', height:160, objectFit:'cover' }} />
                          <div style={{
                            position:'absolute', inset:0, background:'rgba(0,0,0,0.35)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            opacity:0, transition:'opacity 0.15s',
                          }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                          >
                            <span style={{ color:'white', fontWeight:700, fontSize:13 }}>📷 Change Photo</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize:32, marginBottom:6 }}>📷</div>
                          <div style={{ fontWeight:600, fontSize:13, color:'#4B5563', marginBottom:2 }}>Click to upload photo</div>
                          <div style={{ fontSize:11, color:'var(--gray-400)' }}>JPG, PNG or WebP · Max 5 MB</div>
                        </>
                      )}
                    </div>
                    <input ref={customImgRef} type="file" accept="image/*" style={{ display:'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setCustomImgFile(f)
                        setCustomImgPreview(URL.createObjectURL(f))
                      }}
                    />
                  </div>

                  {/* Product name */}
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Product Name *</label>
                    <input
                      type="text" placeholder="e.g. Fresh Coconut Chutney 200g"
                      value={customName} onChange={e => setCustomName(e.target.value)}
                      autoFocus
                      style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>

                  {/* Brand + Unit row */}
                  <div style={{ display:'flex', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Brand / Maker</label>
                      <input
                        type="text" placeholder="e.g. Local Farm"
                        value={customBrand} onChange={e => setCustomBrand(e.target.value)}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Unit / Size</label>
                      <input
                        type="text" placeholder="e.g. 200g, 1L, 1 piece"
                        value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Category *</label>
                    <select
                      value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                      style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:10, fontSize:14, outline:'none', background:'white', cursor:'pointer' }}
                    >
                      {['grocery','dairy','snacks','beverages','personal_care','household','bakery','pharmacy'].map(c => (
                        <option key={c} value={c}>{c.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price */}
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Selling Price (₹) *</label>
                    <div style={{ display:'flex' }}>
                      <span style={{ padding:'10px 14px', background:'var(--gray-100)', border:'1.5px solid var(--gray-200)', borderRight:'none', borderRadius:'10px 0 0 10px', fontWeight:700, color:'var(--gray-500)', fontSize:16 }}>₹</span>
                      <input
                        type="number" placeholder="0" value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomProduct()}
                        min={1}
                        style={{ flex:1, padding:'10px 14px', border:'1.5px solid var(--gray-200)', borderRadius:'0 10px 10px 0', fontSize:18, fontWeight:700, outline:'none' }}
                      />
                    </div>
                  </div>

                  {customError && <div style={{ color:'var(--red)', fontSize:13, padding:'10px 12px', background:'#FEF2F2', borderRadius:8 }}>{customError}</div>}

                  <div style={{ display:'flex', gap:10 }}>
                    <button className="btn-outline" onClick={closeAddModal} style={{ flex:1 }}>Cancel</button>
                    <button
                      className="btn-primary"
                      onClick={handleAddCustomProduct}
                      disabled={customAdding || !customName.trim() || !customPrice}
                      style={{ flex:2 }}
                    >
                      {customAdding ? 'Adding…' : 'Add Custom Product →'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
