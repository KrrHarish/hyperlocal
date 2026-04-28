import { db } from '../../shared/db/knex'

// Calculate delivery fee based on distance (simple for prototype)
function calculateDeliveryFee(orderTotal: number): number {
  if (orderTotal >= 500) return 0
  if (orderTotal >= 200) return 25
  return 40
}

// Generate a 4-digit OTP for delivery confirmation
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function placeOrder(customerId: string, data: {
  shop_id: string
  items: { shop_product_id: string; quantity: number }[]
  delivery_address: {
    line1: string
    city: string
    pincode: string
    lat: number
    lng: number
  }
}) {
  // Fetch all products being ordered
  const productIds = data.items.map(i => i.shop_product_id)
  const shopProducts = await db('shop_products as sp')
    .join('master_products as mp', 'mp.id', 'sp.master_product_id')
    .whereIn('sp.id', productIds)
    .where('sp.shop_id', data.shop_id)
    .select('sp.id', 'sp.price', 'sp.stock_status', 'mp.name', 'mp.brand', 'mp.unit')

  // Check all products are in stock
  for (const product of shopProducts) {
    if (product.stock_status === 'out_of_stock') {
      throw new Error(`${product.name} is out of stock`)
    }
  }

  // Calculate amounts
  const orderItems = data.items.map(item => {
    const product = shopProducts.find(p => p.id === item.shop_product_id)
    if (!product) throw new Error(`Product not found: ${item.shop_product_id}`)
    return {
      shop_product_id: item.shop_product_id,
      product_name: product.name,
      product_brand: product.brand,
      product_unit: product.unit,
      quantity: item.quantity,
      unit_price: parseFloat(product.price),
      subtotal: parseFloat(product.price) * item.quantity,
    }
  })

  const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
  const deliveryFee = calculateDeliveryFee(subtotal)
  const totalAmount = subtotal + deliveryFee

  // Get shop commission rate
  const shop = await db('shops').where({ id: data.shop_id }).first()
  const commissionAmount = (subtotal * parseFloat(shop.commission_rate)) / 100

  const deliveryOtp = generateOTP()

  // Create order and items in a transaction
  const order = await db.transaction(async (trx) => {
    const [newOrder] = await trx('orders').insert({
      customer_id: customerId,
      shop_id: data.shop_id,
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      delivery_address: JSON.stringify(data.delivery_address),
      delivery_otp: deliveryOtp,
      payment_status: 'paid', // prototype: assume paid
      status: 'pending',
    }).returning('*')

    await trx('order_items').insert(
      orderItems.map(item => ({ ...item, order_id: newOrder.id }))
    )

    return newOrder
  })

  return { order, delivery_otp: deliveryOtp }
}

export async function getOrder(orderId: string) {
  const order = await db('orders as o')
    .join('shops as s', 's.id', 'o.shop_id')
    .where({ 'o.id': orderId })
    .select('o.*', 's.name as shop_name', db.raw('o.total_amount as total'))
    .first()
  if (!order) throw new Error('Order not found')

  const items = await db('order_items').where({ order_id: orderId })
  const items_count = items.length
  const preview = items.slice(0, 3).map((i: any) => i.product_name).join(', ')
    + (items.length > 3 ? '…' : '')
  return { ...order, items, items_count, preview }
}

export async function getCustomerOrders(customerId: string) {
  const orders = await db('orders as o')
    .leftJoin('shops as s', 's.id', 'o.shop_id')
    .where({ 'o.customer_id': customerId })
    .orderBy('o.updated_at', 'desc')
    .select('o.*', 's.name as shop_name', db.raw('o.total_amount as total'))

  const enriched = await Promise.all(
    orders.map(async (order: any) => {
      try {
        const items = await db('order_items').where({ order_id: order.id })
        const items_count = items.length
        const preview = items.slice(0, 3).map((i: any) => i.product_name).join(', ')
          + (items.length > 3 ? '…' : '')
        return { ...order, items_count, preview }
      } catch {
        return { ...order, items_count: 0, preview: '' }
      }
    })
  )
  return enriched
}

export async function getShopOrders(shopId: string, status?: string) {
  const query = db('orders').where({ shop_id: shopId })
  if (status) query.where({ status })
  return query.orderBy('created_at', 'desc')
}

export async function updateOrderStatus(orderId: string, status: string, extra = {}) {
  const timestamps: Record<string, any> = {
    confirmed:  { confirmed_at: new Date() },
    assigned:   { assigned_at: new Date() },
    picked_up:  { picked_up_at: new Date() },
    delivered:  { delivered_at: new Date() },
    cancelled:  { cancelled_at: new Date() },
  }

  const [updated] = await db('orders')
    .where({ id: orderId })
    .update({ status, ...timestamps[status], ...extra })
    .returning('*')

  return updated
}

export async function verifyDeliveryOTP(orderId: string, otp: string) {
  const order = await db('orders').where({ id: orderId }).first()
  if (!order) throw new Error('Order not found')
  if (order.status !== 'assigned' && order.status !== 'picked_up') {
    throw new Error('Order is not out for delivery')
  }
  if (order.delivery_otp !== otp) throw new Error('Wrong OTP')

  const [updated] = await db('orders')
    .where({ id: orderId })
    .update({
      status: 'delivered',
      otp_verified: true,
      delivered_at: new Date(),
    })
    .returning('*')

  return updated
}