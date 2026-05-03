import { WebSocketServer, WebSocket } from 'ws'
import Redis from 'ioredis'
import type { Server } from 'http'

const CHANNEL = 'zuqu:broadcast'

let wss: WebSocketServer | null = null

// Dedicated subscriber — never used for commands
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
// Publisher (separate connection required by ioredis when subscribing)
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

sub.on('error', () => {})
pub.on('error', () => {})

export function initWebSocket(httpServer: Server) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (socket) => {
    console.log(`WS client connected — total: ${wss!.clients.size}`)
    socket.send(JSON.stringify({ type: 'connected' }))
    socket.on('error', () => {})
    socket.on('close', () => console.log(`WS client disconnected — total: ${wss!.clients.size}`))
  })

  // Forward every Redis pub/sub message to all connected WebSocket clients
  sub.subscribe(CHANNEL, () => {})
  sub.on('message', (_channel, message) => {
    if (!wss) return
    const count = [...wss.clients].filter(c => c.readyState === WebSocket.OPEN).length
    console.log(`WS broadcast → ${count} clients: ${message.slice(0, 120)}`)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(message)
    })
  })

  console.log('WebSocket server ready at ws://localhost:3000/ws')
}

/** Broadcast an event to every connected client — works from any process */
export function broadcast(event: { type: string; [key: string]: any }) {
  // Also send directly via wss for same-process calls (no Redis round-trip needed)
  if (wss) {
    const msg = JSON.stringify(event)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    })
  }
  // Also publish to Redis so other processes/workers can receive it
  pub.publish(CHANNEL, JSON.stringify(event))
}
