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

export async function getNearbyShops(_lat: number, _lng: number, _radiusKm = 2) {
  // Returns only active (non-suspended) shops.
  // Closed shops (is_open=false) are included so customers can see them as "Closed".
  // Suspended shops (is_active=false) are excluded entirely.
  return db('shops')
    .where({ is_active: true })
    .select('*')
    .orderBy('name', 'asc')
}