import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'
import { insertFeedEvent } from '../shops/shops.service'

export async function dealsRoutes(server: FastifyInstance) {

  // ── GET /deals/active?lat=&lng= — active deals from nearby shops (PUBLIC) ─────
  server.get('/deals/active', async (request, reply) => {
    const now = new Date()
    const deals = await db('shop_deals as d')
      .join('shops as s', 's.id', 'd.shop_id')
      .where('d.is_active', true)
      .where('d.valid_from', '<=', now)
      .where('d.valid_to', '>=', now)
      .where('s.is_active', true)
      .whereRaw('d.uses_count < d.max_uses')
      .select(
        'd.id', 'd.shop_id', 'd.title', 'd.deal_type', 'd.deal_value',
        'd.min_order', 'd.max_discount', 'd.valid_to',
        's.name as shop_name', 's.category as shop_category', 's.image_url as shop_image_url'
      )
      .orderBy('d.deal_value', 'desc')
      .limit(20)
    return reply.send({ deals })
  })

  // ── GET /shops/:shopId/deals — deals for a shop (PUBLIC) ─────────────────────
  server.get('/shops/:shopId/deals', async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const now = new Date()
    const deals = await db('shop_deals')
      .where({ shop_id: shopId, is_active: true })
      .where('valid_from', '<=', now)
      .where('valid_to', '>=', now)
      .orderBy('deal_value', 'desc')
    return reply.send({ deals })
  })

  // ── POST /shops/:shopId/deals — shop owner creates a deal ─────────────────────
  server.post('/shops/:shopId/deals', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const user = request.user as { id: string; role?: string }
    const { shopId } = request.params as { shopId: string }

    // Verify ownership
    if (user.role === 'shop' && user.id !== shopId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { title, deal_type, deal_value, min_order, max_discount, valid_to, max_uses } =
      request.body as any

    if (!title || !deal_type || !deal_value || !valid_to) {
      return reply.status(400).send({ error: 'title, deal_type, deal_value and valid_to are required' })
    }
    if (!['percent', 'flat'].includes(deal_type)) {
      return reply.status(400).send({ error: 'deal_type must be percent or flat' })
    }

    const shop = await db('shops').where({ id: shopId }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    const [deal] = await db('shop_deals').insert({
      shop_id:      shopId,
      title:        title.trim(),
      deal_type,
      deal_value:   parseFloat(deal_value),
      min_order:    min_order ? parseFloat(min_order) : 0,
      max_discount: max_discount ? parseFloat(max_discount) : null,
      valid_from:   new Date(),
      valid_to:     new Date(valid_to),
      max_uses:     max_uses ? parseInt(max_uses) : 1000,
    }).returning('*')

    // Post to neighbourhood feed
    const emoji = deal_type === 'percent' ? `${deal_value}% OFF` : `₹${deal_value} OFF`
    insertFeedEvent(shopId, 'deal_posted', `🏷️ ${shop.name} — ${emoji}: ${title}`, undefined, shop.image_url).catch(() => {})

    return reply.status(201).send({ deal })
  })

  // ── PATCH /shops/:shopId/deals/:dealId — update / deactivate ─────────────────
  server.patch('/shops/:shopId/deals/:dealId', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId, dealId } = request.params as { shopId: string; dealId: string }
    const user = request.user as { id: string; role?: string }
    if (user.role === 'shop' && user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })

    const updates = request.body as any
    const allowed = ['title', 'deal_type', 'deal_value', 'min_order', 'max_discount', 'valid_to', 'is_active', 'max_uses']
    const patch: any = { updated_at: new Date() }
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k]
    }

    const [deal] = await db('shop_deals').where({ id: dealId, shop_id: shopId }).update(patch).returning('*')
    if (!deal) return reply.status(404).send({ error: 'Deal not found' })
    return reply.send({ deal })
  })

  // ── DELETE /shops/:shopId/deals/:dealId ───────────────────────────────────────
  server.delete('/shops/:shopId/deals/:dealId', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId, dealId } = request.params as { shopId: string; dealId: string }
    const user = request.user as { id: string; role?: string }
    if (user.role === 'shop' && user.id !== shopId) return reply.status(403).send({ error: 'Forbidden' })
    await db('shop_deals').where({ id: dealId, shop_id: shopId }).delete()
    return reply.send({ ok: true })
  })
}

// ── Helper: find best active deal for a shop+subtotal and apply it ────────────
export async function applyBestDeal(shopId: string, subtotal: number): Promise<{
  discount: number; dealId: string | null; dealTitle: string | null
}> {
  const now = new Date()
  const deals = await db('shop_deals')
    .where({ shop_id: shopId, is_active: true })
    .where('valid_from', '<=', now)
    .where('valid_to', '>=', now)
    .where('min_order', '<=', subtotal)
    .whereRaw('uses_count < max_uses')
    .orderBy('deal_value', 'desc')

  if (!deals.length) return { discount: 0, dealId: null, dealTitle: null }

  const deal = deals[0]
  let discount = deal.deal_type === 'percent'
    ? (subtotal * parseFloat(deal.deal_value)) / 100
    : parseFloat(deal.deal_value)

  if (deal.max_discount) discount = Math.min(discount, parseFloat(deal.max_discount))
  discount = Math.min(discount, subtotal)

  return { discount: Math.round(discount * 100) / 100, dealId: deal.id, dealTitle: deal.title }
}
