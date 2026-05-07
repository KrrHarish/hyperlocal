import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'

export async function subscriptionsRoutes(server: FastifyInstance) {

  // ── GET /subscriptions — list my active subscriptions ────────────────────────
  server.get('/subscriptions', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string }

    const subs = await db('subscriptions as s')
      .join('shops as sh', 'sh.id', 's.shop_id')
      .where('s.customer_id', user.id)
      .select('s.*', 'sh.name as shop_name', 'sh.category as shop_category', 'sh.image_url as shop_image_url')
      .orderBy('s.created_at', 'desc')

    // Attach items for each
    for (const sub of subs) {
      sub.items = await db('subscription_items').where({ subscription_id: sub.id })
    }

    return reply.send({ subscriptions: subs })
  })

  // ── POST /subscriptions — create a new subscription ──────────────────────────
  server.post('/subscriptions', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string }
    const { shop_id, items, delivery_address, frequency, day_of_week, label } = request.body as any

    if (!shop_id || !items?.length || !delivery_address || !frequency) {
      return reply.status(400).send({ error: 'shop_id, items, delivery_address and frequency are required' })
    }
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return reply.status(400).send({ error: 'Invalid frequency' })
    }

    const nextRunAt = computeNextRun(frequency, day_of_week)

    const [sub] = await db('subscriptions').insert({
      customer_id:      user.id,
      shop_id,
      delivery_address: JSON.stringify(delivery_address),
      frequency,
      day_of_week:      day_of_week ?? null,
      next_run_at:      nextRunAt,
      label:            label ?? null,
    }).returning('*')

    const itemRows = items.map((i: any) => ({
      subscription_id: sub.id,
      shop_product_id: i.shop_product_id,
      product_name:    i.product_name,
      quantity:        i.quantity,
      unit_price:      i.unit_price,
    }))
    await db('subscription_items').insert(itemRows)
    sub.items = itemRows

    return reply.status(201).send({ subscription: sub })
  })

  // ── PATCH /subscriptions/:id — pause / resume / change day ───────────────────
  server.patch('/subscriptions/:id', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { is_active, day_of_week, frequency, label } = request.body as any

    const patch: any = { updated_at: new Date() }
    if (is_active !== undefined) patch.is_active = is_active
    if (day_of_week !== undefined) patch.day_of_week = day_of_week
    if (frequency !== undefined) {
      patch.frequency = frequency
      patch.next_run_at = computeNextRun(frequency, day_of_week)
    }
    if (label !== undefined) patch.label = label

    const [sub] = await db('subscriptions')
      .where({ id, customer_id: user.id })
      .update(patch).returning('*')

    if (!sub) return reply.status(404).send({ error: 'Subscription not found' })
    return reply.send({ subscription: sub })
  })

  // ── DELETE /subscriptions/:id — cancel ───────────────────────────────────────
  server.delete('/subscriptions/:id', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    await db('subscriptions').where({ id, customer_id: user.id }).delete()
    return reply.send({ ok: true })
  })
}

function computeNextRun(frequency: string, dayOfWeek?: number): Date {
  const now = new Date()
  switch (frequency) {
    case 'daily':    return new Date(now.getTime() + 24 * 3600 * 1000)
    case 'weekly': {
      const target = dayOfWeek ?? now.getDay()
      const daysUntil = (target - now.getDay() + 7) % 7 || 7
      return new Date(now.getTime() + daysUntil * 24 * 3600 * 1000)
    }
    case 'biweekly': return new Date(now.getTime() + 14 * 24 * 3600 * 1000)
    case 'monthly':  return new Date(now.getTime() + 30 * 24 * 3600 * 1000)
    default:         return new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  }
}
