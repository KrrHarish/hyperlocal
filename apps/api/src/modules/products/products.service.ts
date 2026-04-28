import { db } from '../../shared/db/knex'

export async function searchMasterCatalog(query: string) {
  return db('master_products')
    .where('is_approved', true)
    .where(function () {
      this.where('name', 'ilike', `%${query}%`)
        .orWhere('brand', 'ilike', `%${query}%`)
    })
    .select('*')
    .limit(20)
}

export async function addProductToShop(shopId: string, data: {
  master_product_id: string
  price: number
  quantity?: number
}) {
  const [product] = await db('shop_products')
    .insert({
      shop_id: shopId,
      master_product_id: data.master_product_id,
      price: data.price,
      quantity: data.quantity || 0,
    })
    .returning('*')

  return product
}

export async function getShopProducts(shopId: string) {
  return db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .where('sp.shop_id', shopId)
    .where('sp.is_visible', true)
    .select(
      'sp.id',
      'sp.price',
      'sp.stock_status',
      'sp.quantity',
      'mp.name',
      'mp.brand',
      'mp.category',
      'mp.unit',
      'mp.image_url'
    )
}

export async function getProductsByCategory(category: string) {
  return db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .join('shops as s', 's.id', 'sp.shop_id')
    .where('mp.category', category.toLowerCase())
    .where('sp.is_visible', true)
    .select(
      'sp.id', 'sp.price', 'sp.stock_status',
      'mp.name', 'mp.brand', 'mp.category', 'mp.unit',
      's.id as shop_id', 's.name as shop_name',
      's.address as shop_address', 's.rating as shop_rating',
      's.is_open as shop_is_open'
    )
    .limit(60)
}

export async function updateStockStatus(shopProductId: string, shopId: string, status: string) {
  const [updated] = await db('shop_products')
    .where({ id: shopProductId, shop_id: shopId })
    .update({ stock_status: status })
    .returning('*')

  return updated
}