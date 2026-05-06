import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCustomers } from '../api/client'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(1)
  const [search,    setSearch]    = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: '20' }
    if (search) params.search = search
    getCustomers(params).then(r => {
      setCustomers(r.data.customers)
      setTotal(r.data.total)
      setPages(r.data.pages || 1)
    }).finally(() => setLoading(false))
  }, [search, page])

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Customers</h1>
        <p style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{total.toLocaleString()} registered customers</p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <input
          placeholder="Search by phone or name..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
          style={inputStyle}
        />
        <button onClick={() => { setSearch(searchInput); setPage(1) }} style={btnStyle}>Search</button>
        {search && <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
          style={{ ...btnStyle, background:'transparent', color:'#EF4444', border:'1px solid #EF444440' }}>Clear</button>}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'#22C55E' }}>Loading...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Phone','Name','Joined','Orders','Total Spent'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}
                    style={{ borderBottom:'1px solid #1a1a1a', cursor:'pointer' }}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={td}>
                      <span style={{ color:'#fff', fontWeight:700 }}>{c.phone}</span>
                    </td>
                    <td style={td}>{c.name ?? <span style={{ color:'#333' }}>—</span>}</td>
                    <td style={{ ...td, color:'#555' }}>{fmtDate(c.created_at)}</td>
                    <td style={{ ...td, color:'#22C55E', fontWeight:700 }}>{Number(c.order_count)}</td>
                    <td style={{ ...td, fontWeight:700 }}>{fmt(c.total_spent)}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign:'center', color:'#444', padding:40 }}>No customers found</td></tr>
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
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, overflow:'hidden' }
const th: React.CSSProperties = { textAlign:'left', padding:'10px 14px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap', background:'#111' }
const td: React.CSSProperties = { padding:'12px 14px', fontSize:13, color:'#aaa', whiteSpace:'nowrap' }
const inputStyle: React.CSSProperties = { padding:'8px 12px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, outline:'none', minWidth:260 }
const btnStyle: React.CSSProperties = { padding:'8px 16px', background:'#22C55E', border:'none', borderRadius:8, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }
const pageBtn: React.CSSProperties = { padding:'7px 16px', background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }
