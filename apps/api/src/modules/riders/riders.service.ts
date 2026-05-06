import { db } from '../../shared/db/knex'
import { redis } from '../../shared/redis'

// Register a new rider
export async function registerRider(data: {
  phone: string
  name: string
  vehicle_type: string
}) {
  const existing = await db('riders').where({ phone: data.phone }).first()
  if (existing) throw new Error('Rider already registered with this phone')

  const [rider] = await db('riders')
    .insert({
      phone: data.phone,
      name: data.name,
      vehicle_type: data.vehicle_type,
      is_verified: true, // prototype: auto-verify, add manual review later
    })
    .returning('*')

  return rider
}

// Get rider by phone
export async function getRiderByPhone(phone: string) {
  return db('riders').where({ phone }).first()
}

// Toggle rider online/offline and update location
export async function toggleOnline(riderId: string, isOnline: boolean, lat?: number, lng?: number) {
  const updateData: any = { is_online: isOnline }

  if (isOnline && lat && lng) {
    updateData.lat = lat
    updateData.lng = lng
    updateData.location_updated = new Date()

    // Store in Redis for fast geo queries — 10 min TTL (refreshed on every location ping)
    await redis.set(
      `rider_location:${riderId}`,
      JSON.stringify({ lat, lng, updated: new Date() }),
      'EX',
      600
    )
  }

  if (!isOnline) {
    await redis.del(`rider_location:${riderId}`)
  }

  const [updated] = await db('riders')
    .where({ id: riderId })
    .update(updateData)
    .returning('*')

  // Notify all connected clients so CartScreens re-check availability immediately
  const { broadcast } = await import('../../shared/realtime')
  broadcast({ type: isOnline ? 'rider_online' : 'rider_offline', riderId })

  return updated
}

// Update rider live location
export async function updateLocation(riderId: string, lat: number, lng: number) {
  await db('riders')
    .where({ id: riderId })
    .update({ lat, lng, location_updated: new Date() })

  // Update Redis cache — 10 min TTL
  await redis.set(
    `rider_location:${riderId}`,
    JSON.stringify({ lat, lng, updated: new Date() }),
    'EX',
    600
  )
}

// Find nearest available riders to a shop (within radiusKm)
export async function findNearestRiders(
  shopLat: number,
  shopLng: number,
  radiusKm: number = 2
) {
  const riders = await db('riders')
    .where({ is_online: true, is_verified: true, is_suspended: false })
    .whereNotNull('lat')
    .whereNotNull('lng')
    .select('*')
    .orderBy('trust_score', 'desc')

  if (riders.length === 0) return []

  // Filter out "ghost-online" riders — those whose Redis location key has expired
  // (rider app crashed or lost connection without explicitly going offline).
  // The Redis key `rider_location:<id>` has a 10-min TTL, refreshed on every
  // location ping. If it's gone, the rider is effectively unreachable.
  const pipeline = redis.pipeline()
  for (const rider of riders) {
    pipeline.exists(`rider_location:${rider.id}`)
  }
  const results = await pipeline.exec()
  const activeRiders = riders.filter((_: any, i: number) => {
    const [err, exists] = results?.[i] ?? [null, 0]
    return !err && exists === 1
  })

  // Auto-correct stale is_online flags in the background (fire-and-forget)
  const staleIds = riders
    .filter((_: any, i: number) => {
      const [err, exists] = results?.[i] ?? [null, 0]
      return !err && exists === 0
    })
    .map((r: any) => r.id)
  if (staleIds.length > 0) {
    db('riders').whereIn('id', staleIds).update({ is_online: false }).catch(() => {})
  }

  // Calculate distance for each active rider and filter by radius
  const nearby = activeRiders
    .map((rider: any) => {
      const dist = haversineDistance(
        shopLat, shopLng,
        parseFloat(rider.lat),
        parseFloat(rider.lng)
      )
      return { ...rider, distance_km: dist }
    })
    .filter((r: any) => r.distance_km <= radiusKm)
    .sort((a: any, b: any) => a.distance_km - b.distance_km)

  return nearby
}

// Haversine formula — distance between two lat/lng points in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Assign a rider to an order — uses Redis lock to prevent double assignment
export async function assignRiderToOrder(orderId: string, riderId: string) {
  const lockKey = `order_lock:${orderId}`

  // Atomic lock — only one rider can claim this order
  const locked = await redis.set(lockKey, riderId, 'EX', 30, 'NX')
  if (!locked) throw new Error('Order already taken by another rider')

  const [order] = await db('orders')
    .where({ id: orderId, status: 'confirmed' })
    .update({
      rider_id: riderId,
      status: 'assigned',
      assigned_at: new Date(),
    })
    .returning('*')

  if (!order) {
    await redis.del(lockKey)
    throw new Error('Order is no longer available')
  }

  return order
}

// Get rider's active order
export async function getRiderActiveOrder(riderId: string) {
  return db('orders')
    .where({ rider_id: riderId })
    .whereIn('status', ['assigned', 'picked_up'])
    .first()
}

// Get rider earnings — optionally filtered by date range
export async function getRiderEarnings(riderId: string, from?: Date, to?: Date) {
  let q = db('orders').where({ rider_id: riderId, status: 'delivered' })
  if (from) q = q.where('delivered_at', '>=', from)
  if (to)   q = q.where('delivered_at', '<=', to)

  const summary = await q.clone()
    .count('id as total_deliveries')
    .sum('delivery_fee as total_earned')
    .first()

  // Daily breakdown — group by date within the period
  const daily: { date: string; earned: number; deliveries: number }[] = await q.clone()
    .select(db.raw("DATE(delivered_at) as date"))
    .count('id as deliveries')
    .sum('delivery_fee as earned')
    .groupByRaw("DATE(delivered_at)")
    .orderBy('date', 'asc')

  return {
    total_deliveries: Number(summary?.total_deliveries || 0),
    total_earned:     Number(summary?.total_earned     || 0),
    wallet_balance:   Number((await db('riders').where({ id: riderId }).first())?.wallet_balance || 0),
    daily: daily.map(d => ({
      date:       d.date,
      earned:     Number(d.earned),
      deliveries: Number(d.deliveries),
    })),
  }
}

// Offer an order to the nearest available rider
export async function offerOrderToRider(
  orderId: string,
  shopId: string,
  shopLat: number,
  shopLng: number,
  excludeRiderIds: string[] = []
) {
  const { broadcast } = await import('../../shared/realtime')

  // Find active rider IDs (already on a delivery)
  const busyRiderIds = await db('orders')
    .whereIn('status', ['assigned', 'picked_up'])
    .whereNotNull('rider_id')
    .pluck('rider_id')

  const skipIds = [...busyRiderIds, ...excludeRiderIds]

  // Find nearest available rider not in skip list
  const nearbyRiders = await findNearestRiders(shopLat, shopLng, 15)
  const rider = nearbyRiders.find((r: any) => !skipIds.includes(r.id)) || null

  if (!rider) {
    // No riders available — notify shop
    broadcast({ type: 'order_no_riders', orderId, shopId })
    return null
  }

  // Store offer in Redis with 30s TTL
  await redis.set(`order_offered:${orderId}`, JSON.stringify({ riderId: rider.id, excludeRiderIds }), 'EX', 30)

  // Fetch order details to include in the offer
  const order = await db('orders as o')
    .leftJoin('shops as s', 's.id', 'o.shop_id')
    .where({ 'o.id': orderId })
    .select('o.*', 's.name as shop_name', 's.lat as shop_lat', 's.lng as shop_lng')
    .first()

  const items = await db('order_items').where({ order_id: orderId })

  // Broadcast offer only to this specific rider
  broadcast({
    type: 'order_offered',
    orderId,
    riderId: rider.id,
    shopId,
    shopName: order?.shop_name,
    total: order?.total_amount,
    deliveryFee: order?.delivery_fee,
    distanceKm: parseFloat((rider as any).distance_km?.toFixed(1) ?? '0'),
    preview: items.slice(0, 3).map((i: any) => i.product_name).join(', ') + (items.length > 3 ? '…' : ''),
    itemCount: items.length,
  })

  return rider
}

// Rider rejects an order offer — offer to next rider
export async function rejectOrderOffer(orderId: string, riderId: string) {
  const { broadcast } = await import('../../shared/realtime')

  // Get current offer state from Redis
  const raw = await redis.get(`order_offered:${orderId}`)
  const offerState = raw ? JSON.parse(raw) : { riderId, excludeRiderIds: [] }

  // Make sure this rider can't be offered again
  const excludeIds: string[] = [...(offerState.excludeRiderIds || []), riderId]

  // Clear current offer
  await redis.del(`order_offered:${orderId}`)

  // Fetch shop location to find next rider
  const order = await db('orders as o')
    .leftJoin('shops as s', 's.id', 'o.shop_id')
    .where({ 'o.id': orderId })
    .select('o.shop_id', 'o.status', 's.lat as shop_lat', 's.lng as shop_lng')
    .first()

  if (!order || order.status !== 'confirmed') return

  // Try to offer to next rider
  await offerOrderToRider(orderId, order.shop_id, parseFloat(order.shop_lat), parseFloat(order.shop_lng), excludeIds)
}