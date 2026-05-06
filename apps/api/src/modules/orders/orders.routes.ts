import { FastifyInstance } from 'fastify'
import {
  placeOrder,
  getOrder,
  getCustomerOrders,
  getShopOrders,
  updateOrderStatus,
  verifyDeliveryOTP,
  getSurgeInfo,
} from './orders.service'
import { db } from '../../shared/db/knex'

export async function orderRoutes(server: FastifyInstance) {

  // GET /orders/surge — returns current surge pricing info (no auth needed)
  server.get('/orders/surge', async (_request, reply) => {
    return reply.send(getSurgeInfo())
  })

  // POST /customers/push-token — save customer Expo push token
  server.post('/customers/push-token', async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = req.user as { id: string }
    const { token, platform } = req.body as { token: string; platform?: string }
    if (!token) return reply.status(400).send({ error: 'token required' })
    await db('customer_push_tokens')
      .insert({ customer_id: user.id, token, platform: platform ?? 'unknown' })
      .onConflict(['customer_id', 'token']).ignore()
    return reply.send({ ok: true })
  })

  // POST /orders — customer places an order
  server.post('/orders', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const body = request.body as {
      shop_id: string
      items: { shop_product_id: string; quantity: number }[]
      delivery_address: {
        line1: string
        city: string
        pincode: string
        lat: number
        lng: number
      }
    }

    if (!body.shop_id || !body.items?.length || !body.delivery_address) {
      return reply.status(400).send({ error: 'shop_id, items and delivery_address are required' })
    }

    try {
      const result = await placeOrder(user.id, body)
      return reply.status(201).send({
        message: 'Order placed successfully',
        order: result.order,
        delivery_otp: result.delivery_otp,
      })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // GET /orders/:orderId — get single order
  server.get('/orders/:orderId', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { orderId } = request.params as { orderId: string }
    try {
      const order = await getOrder(orderId)
      return reply.send({ order })
    } catch (err: any) {
      return reply.status(404).send({ error: err.message })
    }
  })

  // GET /orders/:orderId/rider-location — live rider coords for the map
  server.get('/orders/:orderId/rider-location', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const { orderId } = request.params as { orderId: string }
    const { redis } = await import('../../shared/redis')

    try {
      const order = await db('orders as o')
        .leftJoin('riders as r', 'r.id', 'o.rider_id')
        .leftJoin('shops as s', 's.id', 'o.shop_id')
        .where('o.id', orderId)
        .select(
          'o.rider_id', 'o.delivery_address',
          'o.status',
          'r.name as rider_name', 'r.lat as rider_lat', 'r.lng as rider_lng',
          's.lat as shop_lat', 's.lng as shop_lng', 's.name as shop_name',
        )
        .first()

      if (!order) return reply.status(404).send({ error: 'Order not found' })

      // Prefer Redis for freshest rider coords (updated every 15s by rider app)
      let riderLat = order.rider_lat ? parseFloat(order.rider_lat) : null
      let riderLng = order.rider_lng ? parseFloat(order.rider_lng) : null

      if (order.rider_id) {
        const cached = await redis.get(`rider_location:${order.rider_id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          riderLat = parsed.lat
          riderLng = parsed.lng
        }
      }

      const addr = typeof order.delivery_address === 'string'
        ? JSON.parse(order.delivery_address)
        : order.delivery_address

      return reply.send({
        status: order.status,
        rider: order.rider_id && riderLat ? {
          name: order.rider_name,
          lat: riderLat,
          lng: riderLng,
        } : null,
        shop: order.shop_lat ? {
          name: order.shop_name,
          lat: parseFloat(order.shop_lat),
          lng: parseFloat(order.shop_lng),
        } : null,
        delivery: addr?.lat ? {
          lat: parseFloat(addr.lat),
          lng: parseFloat(addr.lng),
          address: [addr.line1, addr.city].filter(Boolean).join(', '),
        } : null,
      })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /orders — get my orders (customer)
  server.get('/orders', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    try {
      const orders = await getCustomerOrders(user.id)
      return reply.send({ orders })
    } catch (err: any) {
      server.log.error({ err }, 'getCustomerOrders failed')
      return reply.status(500).send({ error: err.message || 'Failed to fetch orders' })
    }
  })

  // GET /shops/:shopId/orders — shop sees incoming orders
  server.get('/shops/:shopId/orders', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { shopId } = request.params as { shopId: string }
    const { status } = request.query as { status?: string }
    const orders = await getShopOrders(shopId, status)
    return reply.send({ orders })
  })

  // PATCH /orders/:orderId/status — update order status
  server.patch('/orders/:orderId/status', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { orderId } = request.params as { orderId: string }
    const { status, reason } = request.body as { status: string; reason?: string }

    const allowed = ['confirmed', 'assigned', 'picked_up', 'cancelled']
    if (!allowed.includes(status)) {
      return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` })
    }

    // Prevent cancellation once a rider has accepted the order
    if (status === 'cancelled') {
      const { db } = await import('../../shared/db/knex')
      const current = await db('orders').where({ id: orderId }).first()
      if (!current) return reply.status(404).send({ error: 'Order not found' })
      const nonCancellable = ['assigned', 'picked_up', 'delivered']
      if (nonCancellable.includes(current.status)) {
        return reply.status(400).send({
          error: `Cannot cancel — rider has already ${
            current.status === 'assigned' ? 'accepted the order' :
            current.status === 'picked_up' ? 'picked up the order' :
            'delivered the order'
          }`
        })
      }
    }

    const extra = reason ? { cancellation_reason: reason } : {}
    const order = await updateOrderStatus(orderId, status, extra)
    return reply.send({ message: `Order ${status}`, order })
  })

  // POST /orders/:orderId/deliver — rider delivers with OTP
  server.post('/orders/:orderId/deliver', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { orderId } = request.params as { orderId: string }
    const { otp } = request.body as { otp: string }

    if (!otp) return reply.status(400).send({ error: 'OTP is required' })

    try {
      const order = await verifyDeliveryOTP(orderId, otp)
      return reply.send({ message: 'Order delivered successfully', order })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}