import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'

export async function ratingsRoutes(server: FastifyInstance) {

  // POST /orders/:orderId/rate — customer rates a delivered order
  server.post('/orders/:orderId/rate', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }
    const { rider_rating, shop_rating, review } = request.body as {
      rider_rating?: number
      shop_rating?: number
      review?: string
    }

    // Validate rating values
    if (rider_rating !== undefined && (rider_rating < 1 || rider_rating > 5)) {
      return reply.status(400).send({ error: 'rider_rating must be between 1 and 5' })
    }
    if (shop_rating !== undefined && (shop_rating < 1 || shop_rating > 5)) {
      return reply.status(400).send({ error: 'shop_rating must be between 1 and 5' })
    }

    // Fetch the order
    const order = await db('orders').where({ id: orderId }).first()
    if (!order) return reply.status(404).send({ error: 'Order not found' })

    // Must belong to this customer
    if (order.customer_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Must be delivered
    if (order.status !== 'delivered') {
      return reply.status(400).send({ error: 'Order must be delivered before rating' })
    }

    // Only one rating per order
    const existing = await db('order_ratings').where({ order_id: orderId }).first()
    if (existing) {
      return reply.status(409).send({ error: 'Order already rated' })
    }

    // Insert rating
    const [rating] = await db('order_ratings').insert({
      order_id: orderId,
      customer_id: user.id,
      rider_id: order.rider_id ?? null,
      shop_id: order.shop_id,
      rider_rating: rider_rating ?? null,
      shop_rating: shop_rating ?? null,
      review: review ?? null,
    }).returning('*')

    // Update rider trust_score if rider_rating given
    if (rider_rating !== undefined && order.rider_id) {
      const rider = await db('riders').where({ id: order.rider_id }).first()
      if (rider) {
        const deliveries = Number(rider.rejection_count ?? 0) // use deliveries count
        // Fetch actual delivery count for this rider
        const deliveriesRow = await db('orders')
          .where({ rider_id: order.rider_id, status: 'delivered' })
          .count('id as count')
          .first()
        const totalDeliveries = Number(deliveriesRow?.count ?? 1)
        const currentScore = parseFloat(rider.trust_score) || 70
        // Weighted rolling average capped to 100
        const newScore = Math.min(
          100,
          (currentScore * (totalDeliveries - 1) + rider_rating * 20) / totalDeliveries
        )
        await db('riders').where({ id: order.rider_id }).update({
          trust_score: Math.round(newScore * 100) / 100,
        })
      }
    }

    return reply.status(201).send({ rating })
  })

  // GET /orders/:orderId/rating — get rating for an order
  server.get('/orders/:orderId/rating', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }

    // Verify order belongs to customer
    const order = await db('orders').where({ id: orderId }).first()
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (order.customer_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const rating = await db('order_ratings').where({ order_id: orderId }).first()
    return reply.send({ rating: rating ?? null })
  })
}
