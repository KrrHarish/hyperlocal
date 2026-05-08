import { FastifyInstance } from 'fastify'
import { createShop, getShopsByOwner, getNearbyShops, getLateNightShops } from './shops.service'
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

  // Helper — require shop credential JWT and set request.shopId
  async function shopAuth(request: any, reply: any) {
    try {
      await request.jwtVerify()
      const user = request.user as { id: string; role?: string }
      if (user.role !== 'shop') {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      request.shopId = user.id
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // GET /shops/nearby?lat=&lng=&radius=&type=home_producer&open_now=true — PUBLIC
  server.get('/shops/nearby', async (request, reply) => {
    const { lat, lng, radius, type, open_now } = request.query as {
      lat: string; lng: string; radius?: string; type?: string; open_now?: string
    }
    if (!lat || !lng) return reply.status(400).send({ error: 'lat and lng are required' })
    const shops = await getNearbyShops(
      parseFloat(lat), parseFloat(lng),
      radius ? parseFloat(radius) : 2,
      { type, open_now: open_now === 'true' }
    )
    return reply.send({ shops })
  })

  // GET /shops/late-night — shops open late or 24h — PUBLIC
  server.get('/shops/late-night', async (_request, reply) => {
    const shops = await getLateNightShops()
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

  // GET /shop-portal/subscription  — get current shop's subscription + trial status
  server.get('/shop-portal/subscription', { preHandler: [shopAuth] }, async (request, reply) => {
    const shopId = (request as any).shopId
    const sub = await db('shop_subscriptions').where({ shop_id: shopId }).first()
    const planKey = sub?.plan_key ?? 'free'
    const plan = await db('shop_subscription_plans').where({ key: planKey }).first()

    const isTrial = sub?.status === 'trial'
    const now = new Date()
    const expiresAt: Date | null = sub?.expires_at ? new Date(sub.expires_at) : null

    // Blocked when: trial expired, OR paid plan has an expiry date that passed
    const isExpired = expiresAt !== null && expiresAt < now
    const trialDaysLeft = expiresAt
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return reply.send({
      subscription: sub ?? null,
      plan: plan ?? null,
      plan_key: planKey,
      is_trial: isTrial,
      trial_expired: isTrial && isExpired,
      trial_days_left: isTrial ? trialDaysLeft : null,
      trial_ends_at: isTrial ? sub?.expires_at : null,
      // Generic flag — true whenever ANY subscription (trial or paid) has lapsed
      access_blocked: isExpired,
      expires_at: sub?.expires_at ?? null,
    })
  })

  // POST /shop-portal/subscribe  — shop selects a plan
  server.post('/shop-portal/subscribe', { preHandler: [shopAuth] }, async (request, reply) => {
    const shopId = (request as any).shopId
    const { plan_key } = request.body as { plan_key: string }
    const plan = await db('shop_subscription_plans').where({ key: plan_key, is_active: true }).first()
    if (!plan) return reply.status(400).send({ error: 'Invalid plan' })
    const existing = await db('shop_subscriptions').where({ shop_id: shopId }).first()
    if (existing && existing.admin_override) {
      return reply.status(403).send({ error: 'Subscription managed by admin' })
    }
    const expires_at = plan.monthly_fee > 0
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null
    if (existing) {
      await db('shop_subscriptions').where({ shop_id: shopId }).update({
        plan_key, status: 'active', started_at: new Date(), expires_at, updated_at: new Date(),
      })
    } else {
      await db('shop_subscriptions').insert({ shop_id: shopId, plan_key, status: 'active', expires_at })
    }
    return reply.send({ ok: true, plan_key })
  })

}