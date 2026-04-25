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

export async function getNearbyShops(lat: number, lng: number, radiusKm = 2) {
  // Simple distance formula for prototype — good enough within city scale
  return db('shops')
    .whereRaw(`
      (6371 * acos(
        cos(radians(?)) * cos(radians(lat)) *
        cos(radians(lng) - radians(?)) +
        sin(radians(?)) * sin(radians(lat))
      )) < ?
    `, [lat, lng, lat, radiusKm])
    .where({ is_active: true })
    .select('*')
    .orderByRaw(`
      (6371 * acos(
        cos(radians(?)) * cos(radians(lat)) *
        cos(radians(lng) - radians(?)) +
        sin(radians(?)) * sin(radians(lat))
      )) asc
    `, [lat, lng, lat])
}