import { FastifyInstance } from 'fastify'
import { createShop, getShopsByOwner, getNearbyShops } from './shops.service'
import { db } from '../../shared/db/knex'

export async function shopRoutes(server: FastifyInstance) {

  // Helper — require auth for protected routes only
  async function requireAuth(request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // GET /shops/nearby?lat=12.97&lng=77.59&radius=2 — PUBLIC (no auth)
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

  // GET /shops/:shopId — PUBLIC shop detail (no auth required)
  server.get('/shops/:shopId', async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const shop = await db('shops').where({ id: shopId }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })
    return reply.send({ shop })
  })

  // Save push subscription — PUBLIC (shop portal uses this without user auth)
  server.post('/shops/:shopId/push-subscription', async (req, reply) => {
    const { shopId } = req.params as { shopId: string }
    const { endpoint, p256dh, auth } = req.body as any
    await db('push_subscriptions')
      .insert({ shop_id: shopId, endpoint, p256dh, auth })
      .onConflict(['shop_id', 'endpoint']).ignore()
    return reply.send({ ok: true })
  })

  // Remove push subscription — PUBLIC
  server.delete('/shops/:shopId/push-subscription', async (req, reply) => {
    const { endpoint } = req.body as any
    await db('push_subscriptions').where({ endpoint }).delete()
    return reply.send({ ok: true })
  })

  // POST /shops — create a shop (AUTH REQUIRED)
  server.post('/shops', async (request, reply) => {
    await requireAuth(request, reply); if (reply.sent) return
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

  // GET /shops/my — get my shops (AUTH REQUIRED)
  // Supports both:
  //   - Old JWT: { id: userId }  → looks up shops by owner_id
  //   - New shop-credential JWT: { id: shopId, role: 'shop' } → returns shop directly
  server.get('/shops/my', async (request, reply) => {
    await requireAuth(request, reply); if (reply.sent) return
    const user = request.user as { id: string; role?: string }

    if (user.role === 'shop') {
      // Credential-based login — id IS the shopId
      const { db } = await import('../../shared/db/knex')
      const shop = await db('shops').where({ id: user.id }).first()
      return reply.send({ shops: shop ? [shop] : [] })
    }

    const shops = await getShopsByOwner(user.id)
    return reply.send({ shops })
  })

  // PATCH /shops/:shopId/status — activate and open a shop (AUTH REQUIRED)
  server.patch('/shops/:shopId/status', async (request, reply) => {
    await requireAuth(request, reply); if (reply.sent) return

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