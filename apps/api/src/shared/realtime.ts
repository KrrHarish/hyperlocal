import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

let wss: WebSocketServer | null = null

export function initWebSocket(httpServer: Server) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (socket) => {
    // Send a hello so the client knows it's connected
    socket.send(JSON.stringify({ type: 'connected' }))

    socket.on('error', () => {}) // silently drop errors
  })

  console.log('WebSocket server ready at ws://localhost:3000/ws')
}

/** Broadcast an event to every connected client */
export function broadcast(event: { type: string; [key: string]: any }) {
  if (!wss) return
  const msg = JSON.stringify(event)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  })
}
