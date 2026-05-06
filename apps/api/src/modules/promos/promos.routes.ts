import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'

export async function promosRoutes(server: FastifyInstance) {

  // POST /promo/validate — validate a promo code and calculate discount
  server.post('/promo/validate', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { code, order_total } = request.body as { code: string; order_total: number }

    if (!code || order_total === undefined) {
      return reply.status(400).send({ error: 'code and order_total are required' })
    }

    // Find promo by code (case-insensitive)
    const promo = await db('promo_codes')
      .whereRaw('LOWER(code) = LOWER(?)', [code])
      .first()

    if (!promo) {
      return reply.send({ valid: false, message: 'Invalid promo code' })
    }

    // Check is_active
    if (!promo.is_active) {
      return reply.send({ valid: false, message: 'Promo code is inactive' })
    }

    // Check uses_count < max_uses
    if (promo.uses_count >= promo.max_uses) {
      return reply.send({ valid: false, message: 'Promo code has reached maximum uses' })
    }

    // Check valid_to > now (if set)
    if (promo.valid_to && new Date(promo.valid_to) < new Date()) {
      return reply.send({ valid: false, message: 'Promo code has expired' })
    }

    // Check valid_from <= now
    if (promo.valid_from && new Date(promo.valid_from) > new Date()) {
      return reply.send({ valid: false, message: 'Promo code is not yet active' })
    }

    // Check min_order
    if (order_total < parseFloat(promo.min_order)) {
      return reply.send({
        valid: false,
        message: `Minimum order of ₹${promo.min_order} required for this promo`,
      })
    }

    // Calculate discount
    let discount: number
    const value = parseFloat(promo.value)
    const maxDiscount = promo.max_discount ? parseFloat(promo.max_discount) : Infinity

    if (promo.type === 'percent') {
      discount = Math.min((order_total * value) / 100, maxDiscount)
    } else {
      // flat
      discount = value
    }

    discount = Math.round(discount * 100) / 100
    const final_total = Math.max(0, Math.round((order_total - discount) * 100) / 100)

    return reply.send({
      valid: true,
      discount,
      final_total,
      type: promo.type,
      value,
      code: promo.code,
    })
  })
}
