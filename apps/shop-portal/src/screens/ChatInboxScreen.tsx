import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

interface Thread {
  customer_id: string
  customer_phone: string
  last_message: string
  last_message_at: string
  unread_count: number
}

interface Msg {
  id: string
  sender_role: 'customer' | 'shop'
  body: string
  created_at: string
}

export default function ChatInboxScreen() {
  const { shop } = useAuth()
  const [threads, setThreads]       = useState<Thread[]>([])
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [messages, setMessages]     = useState<Msg[]>([])
  const [reply, setReply]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState(false)
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const wsRef                       = useRef<WebSocket | null>(null)
  const destroyed                   = useRef(false)
  const activeIdRef                 = useRef<string | null>(null)

  // keep ref in sync for use inside WS callbacks
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const loadThreads = async () => {
    if (!shop) return
    try {
      const res = await api.get(`/shops/${shop.id}/chat/threads`)
      setThreads(res.data?.threads ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  const loadMessages = async (customerId: string) => {
    if (!shop) return
    setActiveId(customerId)
    setMessages([])
    try {
      // Pass customer_id so the API knows which thread to load (shop JWT)
      const res = await api.get(`/shops/${shop.id}/chat`, { params: { customer_id: customerId } })
      setMessages(res.data?.messages ?? [])
      // Mark thread as read locally
      setThreads(prev =>
        prev.map(t => t.customer_id === customerId ? { ...t, unread_count: 0 } : t)
      )
    } catch (e: any) {
      console.error('loadMessages error:', e?.response?.data ?? e.message)
    }
  }

  const sendReply = async () => {
    if (!shop || !activeId || !reply.trim() || sending) return
    const body = reply.trim()
    setReply('')
    setSending(true)
    try {
      const res = await api.post(`/shops/${shop.id}/chat/reply`, { customer_id: activeId, body })
      const msg: Msg = res.data.message
      // Add from API response; WS handler will deduplicate by id
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { setReply(body) }
    finally { setSending(false) }
  }

  // WebSocket for live incoming messages
  useEffect(() => {
    if (!shop) return
    destroyed.current = false

    const connect = () => {
      if (destroyed.current) return
      const ws = new WebSocket('ws://localhost:3000/ws')
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type !== 'chat_message') return
          if (!event.room?.startsWith(shop.id)) return

          const custId = event.room.split(':')[1]
          const incoming: Msg = event.message

          // Update thread list
          setThreads(prev => {
            const exists = prev.find(t => t.customer_id === custId)
            const isActive = activeIdRef.current === custId
            if (exists) {
              return prev.map(t => t.customer_id === custId
                ? {
                    ...t,
                    last_message: incoming.body,
                    last_message_at: incoming.created_at,
                    unread_count: isActive ? 0 : t.unread_count + 1,
                  }
                : t
              )
            }
            return [{
              customer_id: custId,
              customer_phone: custId,
              last_message: incoming.body,
              last_message_at: incoming.created_at,
              unread_count: isActive ? 0 : 1,
            }, ...prev]
          })

          // Append to open conversation, deduplicating by id
          if (activeIdRef.current === custId) {
            setMessages(prev => {
              if (prev.some(m => m.id === incoming.id)) return prev
              return [...prev, incoming]
            })
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        } catch {}
      }

      ws.onclose = () => { if (!destroyed.current) setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()

    return () => {
      destroyed.current = true
      wsRef.current?.close()
    }
  }, [shop?.id])

  useEffect(() => { loadThreads() }, [shop?.id])

  useEffect(() => {
    if (messages.length > 0)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 104px)', background: '#f7f8fa',
      borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    }}>

      {/* ── Thread list ── */}
      <div style={{ width: 280, borderRight: '1px solid #e5e7eb', background: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>💬 Customer Messages</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {threads.length} conversation{threads.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Loading…</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: '#888' }}>No messages yet</div>
            </div>
          ) : threads.map(t => (
            <button
              key={t.customer_id}
              onClick={() => loadMessages(t.customer_id)}
              style={{
                width: '100%', padding: '14px 20px', borderBottom: '1px solid #f5f5f5',
                background: activeId === t.customer_id ? '#FFF4E6' : 'white',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderLeft: activeId === t.customer_id ? '3px solid #FF8A00' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                  📱 …{String(t.customer_phone).slice(-4)}
                </span>
                {Number(t.unread_count) > 0 && (
                  <span style={{
                    background: '#FF8A00', color: 'white', borderRadius: 999,
                    fontSize: 10, fontWeight: 800, padding: '2px 7px', flexShrink: 0,
                  }}>{t.unread_count}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.last_message}
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{fmtTime(t.last_message_at)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f7f8fa' }}>
        {!activeId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 52 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Select a conversation</div>
            <div style={{ fontSize: 13, color: '#888' }}>Click a customer on the left to reply</div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 13 }}>
                  No messages yet
                </div>
              ) : messages.map(msg => {
                const isShop = msg.sender_role === 'shop'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isShop ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '10px 14px', borderRadius: 16,
                      background: isShop ? '#FF8A00' : 'white',
                      color: isShop ? 'white' : '#111',
                      borderBottomRightRadius: isShop ? 4 : 16,
                      borderBottomLeftRadius: isShop ? 16 : 4,
                      boxShadow: isShop ? 'none' : '0 1px 4px rgba(0,0,0,0.07)',
                    }}>
                      <div style={{ fontSize: 14, lineHeight: '20px' }}>{msg.body}</div>
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>
                        {fmtTime(msg.created_at)}
                        {isShop && ' · You'}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply bar */}
            <div style={{
              display: 'flex', gap: 10, padding: '12px 16px',
              background: 'white', borderTop: '1px solid #f0f0f0',
              alignItems: 'flex-end',
            }}>
              <textarea
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12,
                  border: '1.5px solid #e5e7eb', fontSize: 14,
                  resize: 'none', fontFamily: 'inherit', outline: 'none', maxHeight: 100,
                }}
                rows={1}
                placeholder="Type a reply…"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                style={{
                  width: 42, height: 42, borderRadius: 21, border: 'none',
                  background: reply.trim() && !sending ? '#FF8A00' : '#ccc',
                  cursor: reply.trim() && !sending ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}
              >
                {sending ? '…' : '→'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
