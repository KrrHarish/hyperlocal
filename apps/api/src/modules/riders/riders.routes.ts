import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'
import {
  registerRider,
  getRiderByPhone,
  toggleOnline,
  updateLocation,
  findNearestRiders,
  assignRiderToOrder,
  getRiderActiveOrder,
  getRiderEarnings,
} from './riders.service'

export async function riderRoutes(server: FastifyInstance) {

  // POST /riders/register — new rider signs up
  server.post('/riders/register', async (request, reply) => {
    const body = request.body as {
      phone: string
      name: string
      vehicle_type?: string
    }

    if (!body.phone || !body.name) {
      return reply.status(400).send({ error: 'phone and name are required' })
    }

    try {
      const rider = await registerRider({
        phone: body.phone,
        name: body.name,
        vehicle_type: body.vehicle_type || 'bike',
      })
      return reply.status(201).send({ message: 'Rider registered', rider })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // POST /riders/login — rider logs in with phone (reuse OTP auth)
  server.post('/riders/login', async (request, reply) => {
    const { phone } = request.body as { phone: string }
    const rider = await getRiderByPhone(phone)
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    if (rider.is_suspended) {
      return reply.status(403).send({ error: 'Account suspended' })
    }

    const token = server.jwt.sign(
      { id: rider.id, phone: rider.phone, role: 'rider' },
      { expiresIn: '30d' }
    )

    return reply.send({ message: 'Login successful', token, rider })
  })

  // POST /riders/toggle-online — go online or offline
  server.post('/riders/toggle-online', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { is_online, lat, lng } = request.body as {
      is_online: boolean
      lat?: number
      lng?: number
    }

    if (is_online && (!lat || !lng)) {
      return reply.status(400).send({ error: 'lat and lng required when going online' })
    }

    const rider = await toggleOnline(user.id, is_online, lat, lng)
    return reply.send({
      message: is_online ? 'You are now online' : 'You are now offline',
      rider
    })
  })

  // POST /riders/location — update live location
  server.post('/riders/location', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { lat, lng } = request.body as { lat: number; lng: number }

    if (!lat || !lng) return reply.status(400).send({ error: 'lat and lng required' })

    await updateLocation(user.id, lat, lng)
    return reply.send({ message: 'Location updated' })
  })

  // GET /riders/nearby?lat=12.9&lng=77.6&radius=2 — find nearby riders (ops use)
  server.get('/riders/nearby', async (request, reply) => {
    const { lat, lng, radius } = request.query as {
      lat: string; lng: string; radius?: string
    }

    if (!lat || !lng) return reply.status(400).send({ error: 'lat and lng required' })

    const riders = await findNearestRiders(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 2
    )

    return reply.send({ riders, count: riders.length })
  })

  // GET /riders/available?shop_id=... — pre-order availability check (no auth needed)
  server.get('/riders/available', async (request, reply) => {
    const { shop_id, lat, lng, radius } = request.query as {
      shop_id?: string
      lat?: string
      lng?: string
      radius?: string
    }

    let shopLat: number
    let shopLng: number

    if (shop_id) {
      const shop = await db('shops').where({ id: shop_id }).first()
      if (!shop) return reply.status(404).send({ error: 'Shop not found' })
      shopLat = parseFloat(shop.lat)
      shopLng = parseFloat(shop.lng)
    } else if (lat && lng) {
      shopLat = parseFloat(lat)
      shopLng = parseFloat(lng)
    } else {
      return reply.status(400).send({ error: 'shop_id or lat/lng required' })
    }

    const radiusKm = radius ? parseFloat(radius) : 10
    const nearbyRiders = await findNearestRiders(shopLat, shopLng, radiusKm)

    // Exclude riders already on an active delivery
    const busyRiderIds = await db('orders')
      .whereIn('status', ['assigned', 'picked_up'])
      .whereNotNull('rider_id')
      .pluck('rider_id')

    const availableRiders = nearbyRiders.filter((r: any) => !busyRiderIds.includes(r.id))

    return reply.send({
      available: availableRiders.length > 0,
      count: availableRiders.length,
      total_nearby: nearbyRiders.length,
    })
  })

  // POST /riders/orders/:orderId/accept — rider accepts an order
  server.post('/riders/orders/:orderId/accept', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }

    try {
      // Re-validate rider is still online at acceptance time (race condition guard)
      const currentRider = await db('riders').where({ id: user.id }).first()
      if (!currentRider?.is_online) {
        return reply.status(400).send({ error: 'You are offline. Go online to accept orders.' })
      }

      // Verify this rider was offered this order
      const { redis } = await import('../../shared/redis')
      const raw = await redis.get(`order_offered:${orderId}`)
      const offer = raw ? JSON.parse(raw) : null

      if (offer && offer.riderId !== user.id) {
        return reply.status(403).send({ error: 'This order was not offered to you' })
      }

      // Clear the offer lock
      await redis.del(`order_offered:${orderId}`)

      const order = await assignRiderToOrder(orderId, user.id)
      const { broadcast } = await import('../../shared/realtime')
      broadcast({ type: 'order_assigned', orderId, riderId: user.id, shopId: order.shop_id })
      broadcast({ type: 'order_updated', orderId, status: 'assigned', shopId: order.shop_id })
      return reply.send({ message: 'Order accepted', order })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // POST /riders/orders/:orderId/reject — rider declines, offer to next rider
  server.post('/riders/orders/:orderId/reject', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }

    const { rejectOrderOffer } = await import('./riders.service')
    await rejectOrderOffer(orderId, user.id)

    return reply.send({ message: 'Order declined' })
  })

  // GET /riders/orders/active — rider's current active order
  server.get('/riders/orders/active', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const order = await getRiderActiveOrder(user.id)
    return reply.send({ order: order || null })
  })

  // GET /riders/earnings?period=today|week|month|year|all — rider's earnings summary
  server.get('/riders/earnings', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { period = 'all', from: fromStr, to: toStr } = request.query as {
      period?: string; from?: string; to?: string
    }

    let fromDate: Date | undefined
    let toDate:   Date | undefined

    // Custom date range takes priority over period
    if (fromStr) {
      fromDate = new Date(fromStr)
      fromDate.setHours(0, 0, 0, 0)
    }
    if (toStr) {
      toDate = new Date(toStr)
      toDate.setHours(23, 59, 59, 999)
    }

    // If no custom range, compute from period
    if (!fromStr && period !== 'all') {
      const now  = new Date()
      fromDate   = new Date(now)
      if (period === 'today') {
        fromDate.setHours(0, 0, 0, 0)
      } else if (period === 'week') {
        fromDate.setDate(now.getDate() - now.getDay())
        fromDate.setHours(0, 0, 0, 0)
      } else if (period === 'month') {
        fromDate.setDate(1); fromDate.setHours(0, 0, 0, 0)
      } else if (period === 'year') {
        fromDate.setMonth(0, 1); fromDate.setHours(0, 0, 0, 0)
      }
    }

    const earnings = await getRiderEarnings(user.id, fromDate, toDate)
    return reply.send({ earnings })
  })

  // GET /riders/me — get current rider's profile
  server.get('/riders/me', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = request.user as { id: string }
    const rider = await db('riders').where({ id: user.id }).first()
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })
    return reply.send({ rider })
  })

  // GET /riders/orders/history — rider's completed deliveries
  server.get('/riders/orders/history', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = request.user as { id: string }
    const orders = await db('orders as o')
      .leftJoin('shops as s', 's.id', 'o.shop_id')
      .where({ 'o.rider_id': user.id })
      .whereIn('o.status', ['delivered', 'cancelled'])
      .orderBy('o.updated_at', 'desc')
      .limit(50)
      .select('o.*', 's.name as shop_name')
    return reply.send({ orders })
  })

  // PATCH /riders/orders/:orderId/pickup — rider confirms they have picked up the order
  server.patch('/riders/orders/:orderId/pickup', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }

    const order = await db('orders').where({ id: orderId, rider_id: user.id }).first()
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (!['assigned', 'confirmed'].includes(order.status)) {
      return reply.status(400).send({ error: 'Order cannot be marked as picked up' })
    }

    const [updated] = await db('orders')
      .where({ id: orderId })
      .update({ status: 'picked_up', picked_up_at: new Date() })
      .returning('*')

    const { broadcast } = await import('../../shared/realtime')
    broadcast({ type: 'order_updated', orderId, status: 'picked_up', shopId: updated?.shop_id })
    return reply.send({ order: updated })
  })

  // POST /riders/orders/:orderId/deliver — verify OTP and mark delivered
  server.post('/riders/orders/:orderId/deliver', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }
    const { otp } = request.body as { otp: string }

    if (!otp) return reply.status(400).send({ error: 'OTP is required' })

    const order = await db('orders').where({ id: orderId, rider_id: user.id }).first()
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (order.status !== 'picked_up') return reply.status(400).send({ error: 'Order has not been picked up yet' })
    if (order.delivery_otp !== otp) return reply.status(400).send({ error: 'Wrong OTP' })

    const [updated] = await db('orders')
      .where({ id: orderId })
      .update({ status: 'delivered', otp_verified: true, delivered_at: new Date() })
      .returning('*')

    const { broadcast } = await import('../../shared/realtime')
    broadcast({ type: 'order_updated', orderId, status: 'delivered', shopId: updated?.shop_id })
    return reply.send({ order: updated })
  })
}