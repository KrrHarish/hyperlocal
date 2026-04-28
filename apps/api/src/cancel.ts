import { FastifyInstance } from 'fastify'
import { db } from './shared/db/knex'
import { updateOrderStatus } from './modules/orders/orders.service'

const CANCELLABLE_STATUSES = ['pending', 'placed', 'confirmed']

export async function cancelOrder(server: FastifyInstance) {
  // POST /orders/:orderId/cancel — customer cancels their own order
  server.post('/orders/:orderId/cancel', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }
    const { reason } = (request.body as { reason?: string }) || {}

    try {
      // Fetch the order and verify ownership
      const order = await db('orders').where({ id: orderId }).first()
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }
      if (order.customer_id !== user.id) {
        return reply.status(403).send({ error: 'You are not authorised to cancel this order' })
      }

      // Guard: only cancellable statuses are allowed
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        return reply.status(400).send({
          error: `Order cannot be cancelled — current status is '${order.status}'`,
        })
      }

      const updated = await updateOrderStatus(orderId, 'cancelled', {
        cancellation_reason: reason ?? null,
      })
      return reply.send({ message: 'Order cancelled successfully', order: updated })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to cancel order' })
    }
  })
}
