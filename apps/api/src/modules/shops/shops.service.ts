import { db } from '../../shared/db/knex'

export async function createShop(ownerId: string, data: {
  name: string
  category: string
  address: string
  lat: number
  lng: number
  phone?: string
}) {
  const [shop] = await db('shops')
    .insert({
      owner_id: ownerId,
      name: data.name,
      category: data.category,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      phone: data.phone,
    })
    .returning('*')

  return shop
}

export async function getShopsByOwner(ownerId: string) {
  return db('shops').where({ owner_id: ownerId })
}

export async function getNearbyShops(_lat: number, _lng: number, _radiusKm = 2, filters: {
  type?: string
  open_now?: boolean
} = {}) {
  let q = db('shops').where({ is_active: true })
  if (filters.type)     q = q.where({ shop_type: filters.type })
  if (filters.open_now) q = q.where({ is_open: true })

  // Try featured-aware sort; fall back to simple sort if migration 027 hasn't run yet
  try {
    return await q.select('*').orderByRaw(`
      CASE WHEN is_featured = true AND (featured_until IS NULL OR featured_until > NOW()) THEN 0 ELSE 1 END ASC,
      featured_sort_order DESC,
      rating DESC NULLS LAST,
      name ASC
    `)
  } catch {
    return q.select('*').orderBy([{ column: 'rating', order: 'desc' }, { column: 'name', order: 'asc' }])
  }
}

export async function getLateNightShops() {
  return db('shops')
    .where({ is_active: true, is_open: true })
    .where(function() {
      this.where({ late_night_tag: true }).orWhere({ is_24h: true })
    })
    .select('*')
    .orderBy('name', 'asc')
}

export async function insertFeedEvent(shopId: string, eventType: string, title: string, body?: string, imageUrl?: string) {
  const shop = await db('shops').where({ id: shopId }).select('lat', 'lng').first()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h TTL
  const [event] = await db('feed_events').insert({
    shop_id:    shopId,
    event_type: eventType,
    title,
    body:       body ?? null,
    image_url:  imageUrl ?? null,
    lat:        shop?.lat ?? null,
    lng:        shop?.lng ?? null,
    expires_at: expiresAt,
  }).returning('*')
  return event
}