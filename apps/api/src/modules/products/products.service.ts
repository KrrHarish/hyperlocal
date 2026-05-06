import { db } from '../../shared/db/knex'

export async function searchMasterCatalog(query: string) {
  // Join with shop_products + shops so results include price, shop_id, shop_name
  return db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .join('shops as s', 's.id', 'sp.shop_id')
    .where('mp.is_approved', true)
    .where('sp.is_visible', true)
    .where('s.is_active', true)
    .where(function () {
      this.where('mp.name', 'ilike', `%${query}%`)
        .orWhere('mp.brand', 'ilike', `%${query}%`)
    })
    .select(
      'sp.id',
      'sp.price',
      'sp.stock_status',
      'sp.custom_image_url',
      'sp.shop_id',
      'mp.name',
      'mp.brand',
      'mp.unit',
      'mp.category',
      'mp.image_url',
      's.name as shop_name',
    )
    .limit(30)
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
      'sp.custom_image_url',
      'mp.name',
      'mp.brand',
      'mp.category',
      'mp.unit',
      'mp.image_url'
    )
}

export async function updateShopProduct(
  productId: string,
  shopId: string,
  data: { price?: number; custom_image_url?: string; name?: string; brand?: string; unit?: string }
) {
  const { name, brand, unit, ...shopData } = data

  // Update shop_products fields (price, image)
  if (Object.keys(shopData).length > 0) {
    await db('shop_products')
      .where({ id: productId, shop_id: shopId })
      .update({ ...shopData, updated_at: new Date() })
  }

  // Update master_products fields (name, brand, unit) via join
  if (name !== undefined || brand !== undefined || unit !== undefined) {
    const masterUpdate: Record<string, any> = {}
    if (name  !== undefined) masterUpdate.name  = name
    if (brand !== undefined) masterUpdate.brand = brand
    if (unit  !== undefined) masterUpdate.unit  = unit
    await db('master_products')
      .whereIn('id', db('shop_products').where({ id: productId, shop_id: shopId }).select('master_product_id'))
      .update(masterUpdate)
  }

  // Return the merged product row
  const [updated] = await db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .where('sp.id', productId)
    .select('sp.*', 'mp.name', 'mp.brand', 'mp.unit', 'mp.category', 'mp.image_url')
  return updated
}

export async function removeShopProduct(productId: string, shopId: string) {
  await db('shop_products')
    .where({ id: productId, shop_id: shopId })
    .update({ is_visible: false })
}

export async function getProductsByCategory(category: string) {
  return db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .join('shops as s', 's.id', 'sp.shop_id')
    .where('mp.category', category.toLowerCase())
    .where('sp.is_visible', true)
    .select(
      'sp.id', 'sp.price', 'sp.stock_status',
      'sp.custom_image_url',
      'mp.name', 'mp.brand', 'mp.category', 'mp.unit', 'mp.image_url',
      's.id as shop_id', 's.name as shop_name',
      's.address as shop_address', 's.rating as shop_rating',
      's.is_open as shop_is_open'
    )
    .limit(60)
}

export async function addCustomProductToShop(shopId: string, data: {
  name: string
  brand?: string
  category: string
  unit?: string
  price: number
}) {
  // 1. Create a new master product entry (auto-approved)
  const [master] = await db('master_products')
    .insert({
      name: data.name,
      brand: data.brand || null,
      category: data.category,
      unit: data.unit || null,
      is_approved: true,
    })
    .returning('*')

  // 2. Add to shop
  const [product] = await db('shop_products')
    .insert({
      shop_id: shopId,
      master_product_id: master.id,
      price: data.price,
      quantity: 0,
    })
    .returning('*')

  return { ...product, name: master.name, brand: master.brand, category: master.category, unit: master.unit }
}

export async function updateStockStatus(shopProductId: string, shopId: string, status: string) {
  const [updated] = await db('shop_products')
    .where({ id: shopProductId, shop_id: shopId })
    .update({ stock_status: status })
    .returning('*')

  return updated
}