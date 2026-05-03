import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { initWebSocket } from './shared/realtime'
import { shopRoutes } from './modules/shops/shops.routes'
import { productRoutes } from './modules/products/products.routes'
import { orderRoutes } from './modules/orders/orders.routes'
import { riderRoutes } from './modules/riders/riders.routes'
import { cancelOrder } from './cancel'

dotenv.config()

import { authRoutes } from './modules/auth/auth.routes'

const server = Fastify({ logger: true })

// Plugins
server.register(cors, {
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})
server.register(jwt, { secret: process.env.JWT_SECRET || 'secret' })
server.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }) // 5 MB max

// Serve uploaded product images
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
server.get('/uploads/:filename', async (request, reply) => {
  const { filename } = request.params as { filename: string }
  const filepath = path.join(UPLOADS_DIR, path.basename(filename))
  if (!fs.existsSync(filepath)) return reply.status(404).send({ error: 'Not found' })
  const ext = path.extname(filename).toLowerCase()
  const mime: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }
  return reply.type(mime[ext] || 'application/octet-stream').send(fs.createReadStream(filepath))
})

// Routes — all mounted under /api to match the mobile client base URL
server.register(authRoutes,    { prefix: '/api' })
server.register(shopRoutes,    { prefix: '/api' })
server.register(productRoutes, { prefix: '/api' })
server.register(orderRoutes,   { prefix: '/api' })
server.register(riderRoutes,   { prefix: '/api' })
server.register(cancelOrder,   { prefix: '/api' })

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3000')
    // Attach WebSocket server to the same HTTP server
    initWebSocket(server.server)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()