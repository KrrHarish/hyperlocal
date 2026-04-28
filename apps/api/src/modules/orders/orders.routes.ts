import { FastifyInstance } from 'fastify'
import {
  placeOrder,
  getOrder,
  getCustomerOrders,
  getShopOrders,
  updateOrderStatus,
  verifyDeliveryOTP,
} from './orders.service'

export async function orderRoutes(server: FastifyInstance) {

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