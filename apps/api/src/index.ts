import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'
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
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()