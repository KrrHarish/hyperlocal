import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRider, suspendRider, verifyRider, adjustWallet } from '../api/client'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

function fmt(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function RiderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError,   setActionError]   = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [showWallet,    setShowWallet]    = useState(false)
  const [walletAmount,  setWalletAmount]  = useState('')
  const [walletNote,    setWalletNote]    = useState('')

  function loadRider() {
    if (!id) return
    return getRider(id).then(r => setData(r.data))
  }

  useEffect(() => {
    if (!id) return
    loadRider()!.finally(() => setLoading(false))
  }, [id])

  async function doAction(fn: () => Promise<any>, successMsg: string) {
    setActionLoading(true); setActionError(''); setActionSuccess('')
    try {
      await fn()
      setActionSuccess(successMsg)
      await loadRider()
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div style={{ padding:48, textAlign:'center', color:'#22C55E' }}>Loading...</div>
  if (!data)   return <div style={{ padding:48, textAlign:'center', color:'#EF4444' }}>Rider not found</div>

  const { rider, earnings, recent_orders } = data

  return (
    <div style={{ padding:'28px 32px', maxWidth:1100 }}>
      {/* Back */}
      <button onClick={() => navigate('/riders')} style={backBtn}>← Back to Riders</button>

      {/* Profile card */}
      <div style={{ ...card, marginBottom:20, display:'flex', flexWrap:'wrap', gap:24, alignItems:'flex-start' }}>
        <div style={{ width:60, height:60, borderRadius:30, background:'#1a3a25', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
          🛵
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{rider.name}</div>
          <div style={{ color:'#555', fontSize:13, marginTop:2 }}>{rider.phone}</div>
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            <Badge status={rider.is_online ? 'online' : 'offline'} />
            {rider.is_suspended ? <Badge status="suspended" /> : <Badge status={rider.is_verified ? 'verified' : 'inactive'} />}
            <span style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:99, padding:'2px 10px', fontSize:12, color:'#aaa', fontWeight:600, textTransform:'capitalize' }}>
              {rider.vehicle_type}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:13, color:'#555', minWidth:200 }}>
          <div>Trust Score: <span style={{ color:'#60A5FA', fontWeight:700 }}>{rider.trust_score ?? 100}</span></div>
          <div>Wallet: <span style={{ color:'#A78BFA', fontWeight:700 }}>{fmt(rider.wallet_balance ?? 0)}</span></div>
          <div>Joined: <span style={{ color:'#aaa' }}>{new Date(rider.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span></div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'flex-start' }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button disabled={actionLoading} onClick={() => doAction(() => suspendRider(id!, rider.is_active === false ? false : true), rider.is_active === false ? 'Rider unsuspended' : 'Rider suspended')}
              style={{ ...actionBtn, background: rider.is_active === false ? '#22C55E' : '#EF4444', color: rider.is_active === false ? '#000' : '#fff' }}>
              {rider.is_active === false ? 'Unsuspend Rider' : 'Suspend Rider'}
            </button>
            <button disabled={actionLoading} onClick={() => doAction(() => verifyRider(id!, !rider.is_verified), rider.is_verified ? 'Verification removed' : 'Rider verified')}
              style={{ ...actionBtn, background: rider.is_verified ? '#444' : '#22C55E', color: rider.is_verified ? '#aaa' : '#000' }}>
              {rider.is_verified ? 'Unverify' : 'Verify Rider'}
            </button>
            <button disabled={actionLoading} onClick={() => { setShowWallet(v => !v); setActionError(''); setActionSuccess('') }}
              style={{ ...actionBtn, background:'#3B82F6', color:'#fff' }}>
              Adjust Wallet
            </button>
          </div>

          {showWallet && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <input type="number" placeholder="Amount (+ or -)" value={walletAmount} onChange={e => setWalletAmount(e.target.value)}
                style={{ padding:'7px 10px', background:'#1a1a1a', border:'1px solid #333', borderRadius:7, color:'#fff', fontSize:13, width:160 }} />
              <input type="text" placeholder="Note" value={walletNote} onChange={e => setWalletNote(e.target.value)}
                style={{ padding:'7px 10px', background:'#1a1a1a', border:'1px solid #333', borderRadius:7, color:'#fff', fontSize:13, width:160 }} />
              <button disabled={actionLoading || !walletAmount} onClick={() => doAction(
                  () => adjustWallet(id!, parseFloat(walletAmount), walletNote),
                  `Wallet adjusted by ₹${walletAmount}`
                ).then(() => { setShowWallet(false); setWalletAmount(''); setWalletNote('') })}
                style={{ ...actionBtn, background:'#3B82F6', color:'#fff' }}>Apply</button>
              <button onClick={() => setShowWallet(false)} style={{ ...actionBtn, background:'transparent', color:'#555', border:'1px solid #333' }}>Cancel</button>
            </div>
          )}

          {actionError   && <div style={{ fontSize:12, color:'#EF4444' }}>{actionError}</div>}
          {actionSuccess && <div style={{ fontSize:12, color:'#22C55E' }}>{actionSuccess}</div>}
        </div>
      </div>

      {/* Earnings stats */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <StatCard label="Total Deliveries" value={earnings.total_deliveries} icon="📦" />
        <StatCard label="Total Earned"     value={fmt(earnings.total_earned)} icon="💰" />
        <StatCard label="Avg / Delivery"   value={fmt(earnings.avg_per_delivery)} icon="📈" accent="#FBBF24" />
      </div>

      {/* Order history */}
      <div style={card}>
        <h2 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Recent Deliveries</h2>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Order #','Shop','Customer','Amount','Delivery Fee','Delivered At'].map(h =>
                <th key={h} style={th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {recent_orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                  <td style={td}><span style={{ color:'#22C55E', fontWeight:700 }}>#{o.order_number}</span></td>
                  <td style={td}>{o.shop_name}</td>
                  <td style={td}>{o.customer_phone}</td>
                  <td style={{ ...td, fontWeight:700 }}>{fmt(o.total_amount)}</td>
                  <td style={{ ...td, color:'#22C55E', fontWeight:700 }}>{fmt(o.delivery_fee)}</td>
                  <td style={{ ...td, color:'#555', fontSize:12 }}>{o.delivered_at ? fmtDate(o.delivered_at) : '—'}</td>
                </tr>
              ))}
              {recent_orders.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, textAlign:'center', color:'#444', padding:32 }}>No deliveries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background:'#161616', border:'1px solid #222', borderRadius:14, padding:'20px 22px' }
const actionBtn: React.CSSProperties = { padding:'7px 14px', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }
const th: React.CSSProperties = { textAlign:'left', padding:'8px 12px', fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #222', whiteSpace:'nowrap' }
const td: React.CSSProperties = { padding:'11px 12px', fontSize:13, color:'#ccc', whiteSpace:'nowrap' }
const backBtn: React.CSSProperties = { background:'none', border:'none', color:'#555', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:20, padding:0 }
