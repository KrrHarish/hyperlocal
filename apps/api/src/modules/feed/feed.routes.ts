import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'

export async function feedRoutes(server: FastifyInstance) {

  // GET /feed?lat=&lng=&limit=20 — neighbourhood activity feed (PUBLIC)
  server.get('/feed', async (request, reply) => {
    const { limit } = request.query as { limit?: string }
    const now = new Date()

    const events = await db('feed_events as f')
      .join('shops as s', 's.id', 'f.shop_id')
      .where('f.expires_at', '>', now)
      .where('s.is_active', true)
      .select(
        'f.id', 'f.shop_id', 'f.event_type', 'f.title', 'f.body',
        'f.image_url', 'f.lat', 'f.lng', 'f.created_at',
        's.name as shop_name', 's.category as shop_category',
        's.image_url as shop_image_url'
      )
      .orderBy('f.created_at', 'desc')
      .limit(Math.min(parseInt(limit ?? '20'), 50))

    return reply.send({ events })
  })
}
