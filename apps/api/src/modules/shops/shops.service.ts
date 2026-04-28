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
  // Prototype: return ALL shops — no distance filter.
  // The simulator uses the dev machine's real GPS (often a different city/country),
  // so a distance filter would always return 0 results during development.
  return db('shops').select('*').orderBy('name', 'asc')
}