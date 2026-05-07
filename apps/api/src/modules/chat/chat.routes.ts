import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'
import { broadcast } from '../../shared/realtime'

export async function chatRoutes(server: FastifyInstance) {

  // ── GET /shops/:shopId/chat — load thread ────────────────────────────────────
  // Customer: loads own thread (customerId from JWT)
  // Shop owner: loads a specific customer's thread (customer_id query param required)
  server.get('/shops/:shopId/chat', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }
    const { customer_id } = request.query as { customer_id?: string }

    let customerId: string
    if (user.role === 'shop') {
      if (user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })
      if (!customer_id) return reply.status(400).send({ error: 'customer_id query param required for shop' })
      customerId = customer_id
    } else {
      customerId = user.id
    }

    const messages = await db('chat_messages')
      .where({ shop_id: shopId, customer_id: customerId })
      .orderBy('created_at', 'asc')
      .limit(100)

    // Mark the OTHER party's unread messages as read
    const markRole = user.role === 'shop' ? 'customer' : 'shop'
    await db('chat_messages')
      .where({ shop_id: shopId, customer_id: customerId, sender_role: markRole, is_read: false })
      .update({ is_read: true })

    return reply.send({ messages })
  })

  // ── POST /shops/:shopId/chat — customer sends a message ──────────────────────
  server.post('/shops/:shopId/chat', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }
    const { body } = request.body as { body: string }

    if (!body?.trim()) return reply.status(400).send({ error: 'Message body is required' })

    const customerId = user.role === 'shop' ? undefined : user.id
    if (!customerId) return reply.status(400).send({ error: 'Only customers can initiate chat here' })

    const [message] = await db('chat_messages').insert({
      shop_id:     shopId,
      customer_id: customerId,
      sender_role: 'customer',
      body:        body.trim(),
    }).returning('*')

    // Fan-out via WebSocket — both parties filter on room
    broadcast({
      type:        'chat_message',
      room:        `${shopId}:${customerId}`,
      message,
    })

    return reply.status(201).send({ message })
  })

  // ── GET /shops/:shopId/chat/threads — shop owner lists all customer threads ───
  server.get('/shops/:shopId/chat/threads', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }
    if (user.role === 'shop' && user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })

    const threads = await db('chat_messages as m')
      .join('users as u', 'u.id', 'm.customer_id')
      .where('m.shop_id', shopId)
      .select(
        'm.customer_id',
        'u.phone as customer_phone',
        db.raw('MAX(m.created_at) as last_message_at'),
        db.raw('COUNT(*) FILTER (WHERE m.is_read = false AND m.sender_role = \'customer\') as unread_count'),
        db.raw('(array_agg(m.body ORDER BY m.created_at DESC))[1] as last_message')
      )
      .groupBy('m.customer_id', 'u.phone')
      .orderBy('last_message_at', 'desc')

    return reply.send({ threads })
  })

  // ── POST /shops/:shopId/chat/reply — shop owner replies to a customer ─────────
  server.post('/shops/:shopId/chat/reply', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }
    if (user.role === 'shop' && user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })

    const { customer_id, body } = request.body as { customer_id: string; body: string }
    if (!customer_id || !body?.trim()) {
      return reply.status(400).send({ error: 'customer_id and body are required' })
    }

    const [message] = await db('chat_messages').insert({
      shop_id:     shopId,
      customer_id,
      sender_role: 'shop',
      body:        body.trim(),
    }).returning('*')

    broadcast({
      type:    'chat_message',
      room:    `${shopId}:${customer_id}`,
      message,
    })

    return reply.status(201).send({ message })
  })

  // ── PATCH /shops/:shopId/chat/read — mark thread as read ─────────────────────
  server.patch('/shops/:shopId/chat/read', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }
    const { customer_id } = request.body as { customer_id: string }
    if (user.role === 'shop' && user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })
    await db('chat_messages')
      .where({ shop_id: shopId, customer_id, sender_role: 'customer' })
      .update({ is_read: true })
    return reply.send({ ok: true })
  })
}
