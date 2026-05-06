import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCustomer } from '../api/client'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getCustomer(id).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding:48, textAlign:'center', color:'#22C55E' }}>Loading...</div>
  if (!data)   return <div style={{ padding:48, textAlign:'center', color:'#EF4444' }}>Customer not found</div>

  const { customer, summary, recent_orders } = data

  return (
    <div style={{ padding:'28px 32px', maxWidth:1100 }}>
      <button onClick={() => navigate('/customers')} style={backBtn}>← Back to Customers</button>

      {/* Profile */}
      <div style={{ ...card, marginBottom:20, display:'flex', flexWrap:'wrap', gap:24, alignItems:'flex-start' }}>
        <div style={{ width:60, height:60, borderRadius:30, background:'#1a1a40', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>
          👤
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{customer.name || customer.phone}</div>
          {customer.name && <div style={{ color:'#555', fontSize:13, marginTop:2 }}>{customer.phone}</div>}
          <div style={{ color:'#555', fontSize:13, marginTop:6 }}>
            Member since {new Date(customer.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <StatCard label="Total Orders" value={summary.order_count} icon="🧾" />
        <StatCard label="Total Spent"  value={fmt(summary.total_spent)} icon="💳" accent="#60A5FA" />
        <StatCard label="Avg Order"
          value={fmt(summary.order_count > 0 ? summary.total_spent / summary.order_count : 0)}
          icon="📊" accent="#FBBF24" />
      </div>

      {/* Order history */}
      <div style={card}>
        <h2 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Order History</h2>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Order #','Shop','Status','Total','Delivery Fee','Placed At'].map(h =>
                <th key={h} style={th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {recent_orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                  <td style={td}><span style={{ color:'#22C55E', fontWeight:700 }}>#{o.order_number}</span></td>
                  <td style={td}>{o.shop_name ?? '—'}</td>
                  <td style={td}><Badge status={o.status} /></td>
                  <td style={{ ...td, fontWeight:700 }}>{fmt(o.total_amount)}</td>
                  <td style={{ ...td, color:'#FBBF24' }}>{fmt(o.delivery_fee)}</td>
                  <td style={{ ...td, color:'#555', fontSize:12 }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
              {recent_orders.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, textAlign:'center', color:'#444', padding:32 }}>No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, padding:'20px 22px' }
const th: React.CSSProperties = { textAlign:'left', padding:'8px 12px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap' }
const td: React.CSSProperties = { padding:'11px 12px', fontSize:13, color:'#ccc', whiteSpace:'nowrap' }
const backBtn: React.CSSProperties = { background:'none', border:'none', color:'#555', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:20, padding:0 }
