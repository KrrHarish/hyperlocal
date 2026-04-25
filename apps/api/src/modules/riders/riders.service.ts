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

    // Store in Redis for fast geo queries
    await redis.set(
  `rider_location:${riderId}`,
  JSON.stringify({ lat, lng, updated: new Date() }),
  'EX',
  300
)
  }

  if (!isOnline) {
    await redis.del(`rider_location:${riderId}`)
  }

  const [updated] = await db('riders')
    .where({ id: riderId })
    .update(updateData)
    .returning('*')

  return updated
}

// Update rider live location
export async function updateLocation(riderId: string, lat: number, lng: number) {
  await db('riders')
    .where({ id: riderId })
    .update({ lat, lng, location_updated: new Date() })

  // Update Redis cache
 await redis.set(
  `rider_location:${riderId}`,
  JSON.stringify({ lat, lng, updated: new Date() }),
  'EX',
  300
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

  // Calculate distance for each rider and filter by radius
  const nearby = riders
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

// Get rider earnings
export async function getRiderEarnings(riderId: string) {
  const delivered = await db('orders')
    .where({ rider_id: riderId, status: 'delivered' })
    .count('id as total_deliveries')
    .sum('delivery_fee as total_earned')
    .first()

  return {
    total_deliveries: delivered?.total_deliveries || 0,
    total_earned: delivered?.total_earned || 0,
    wallet_balance: (await db('riders').where({ id: riderId }).first())?.wallet_balance || 0,
  }
}