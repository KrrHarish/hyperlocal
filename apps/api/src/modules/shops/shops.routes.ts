import { FastifyInstance } from 'fastify'
import { createShop, getShopsByOwner, getNearbyShops } from './shops.service'
import { db } from '../../shared/db/knex'

export async function shopRoutes(server: FastifyInstance) {

  // Middleware — verify JWT on all shop routes (skip CORS preflight)
  server.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // POST /shops — create a shop
  server.post('/shops', async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as {
      name: string
      category: string
      address: string
      lat: number
      lng: number
      phone?: string
    }

    if (!body.name || !body.category || !body.address || !body.lat || !body.lng) {
      return reply.status(400).send({ error: 'name, category, address, lat, lng are required' })
    }

    try {
      const shop = await createShop(user.id, body)
      return reply.status(201).send({ message: 'Shop created', shop })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /shops/my — get my shops
  server.get('/shops/my', async (request, reply) => {
    const user = request.user as { id: string }
    const shops = await getShopsByOwner(user.id)
    return reply.send({ shops })
  })

  // GET /shops/nearby?lat=12.97&lng=77.59&radius=2
  server.get('/shops/nearby', async (request, reply) => {
    const { lat, lng, radius } = request.query as {
      lat: string; lng: string; radius?: string
    }

    if (!lat || !lng) {
      return reply.status(400).send({ error: 'lat and lng are required' })
    }

    const shops = await getNearbyShops(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 2
    )
    return reply.send({ shops })
  })

  // GET /shops/:shopId — public shop detail (no auth required)
  server.get('/shops/:shopId', async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const shop = await db('shops').where({ id: shopId }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })
    return reply.send({ shop })
  })

  // Save push subscription
  server.post('/shops/:shopId/push-subscription', async (req, reply) => {
    const { shopId } = req.params as { shopId: string }
    const { endpoint, p256dh, auth } = req.body as any
    await db('push_subscriptions')
      .insert({ shop_id: shopId, endpoint, p256dh, auth })
      .onConflict(['shop_id', 'endpoint']).ignore()
    return reply.send({ ok: true })
  })

  // Remove push subscription
  server.delete('/shops/:shopId/push-subscription', async (req, reply) => {
    const { endpoint } = req.body as any
    await db('push_subscriptions').where({ endpoint }).delete()
    return reply.send({ ok: true })
  })

  // PATCH /shops/:shopId/status — activate and open a shop
server.patch('/shops/:shopId/status', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const { shopId } = request.params as { shopId: string }
  const { is_active, is_open } = request.body as {
    is_active?: boolean
    is_open?: boolean
  }

  const [updated] = await db('shops')
    .where({ id: shopId })
    .update({ is_active, is_open })
    .returning('*')

  return reply.send({ message: 'Shop status updated', shop: updated })
})

}