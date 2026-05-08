import { db } from '../../shared/db/knex'
import { sendPushToShop } from '../../shared/push'
import { sendPushToCustomer } from '../../shared/expoPush'
import { broadcast } from '../../shared/realtime'

// Calculate delivery fee with time-based surge pricing
// Thresholds: <₹150 = ₹49 (discourages tiny orders), ₹150–₹399 = ₹25, ₹400+ = free
async function calculateDeliveryFee(orderTotal: number): Promise<number> {
  const base = orderTotal >= 400 ? 0 : orderTotal >= 150 ? 25 : 49
  if (base === 0) return 0 // free delivery stays free

  const hour = new Date().getHours() // local time (IST when deployed in India)
  let surge = 1.0
  if (hour >= 7  && hour < 9)  surge = 1.2  // morning rush
  if (hour >= 12 && hour < 14) surge = 1.3  // lunch rush
  if (hour >= 18 && hour < 21) surge = 1.5  // dinner rush

  return Math.round(base * surge)
}

export function getSurgeInfo(): { active: boolean; multiplier: number; label: string } {
  const hour = new Date().getHours()
  if (hour >= 7  && hour < 9)  return { active: true,  multiplier: 1.2, label: 'Morning Rush' }
  if (hour >= 12 && hour < 14) return { active: true,  multiplier: 1.3, label: 'Lunch Rush' }
  if (hour >= 18 && hour < 21) return { active: true,  multiplier: 1.5, label: 'Dinner Rush' }
  return { active: false, multiplier: 1.0, label: 'Normal' }
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
  promo_code?: string
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
  const deliveryFee = await calculateDeliveryFee(subtotal)

  // Apply promo code discount if provided
  let discountAmount = 0
  if (data.promo_code) {
    const promo = await db('promo_codes')
      .whereRaw('LOWER(code) = LOWER(?)', [data.promo_code])
      .where('is_active', true)
      .first()

    if (promo &&
        promo.uses_count < promo.max_uses &&
        (!promo.valid_to || new Date(promo.valid_to) > new Date()) &&
        subtotal >= parseFloat(promo.min_order)
    ) {
      const value = parseFloat(promo.value)
      const maxDiscount = promo.max_discount ? parseFloat(promo.max_discount) : Infinity
      if (promo.type === 'percent') {
        discountAmount = Math.min((subtotal * value) / 100, maxDiscount)
      } else {
        discountAmount = value
      }
      discountAmount = Math.round(discountAmount * 100) / 100
      // Increment uses_count
      await db('promo_codes').where({ id: promo.id }).increment('uses_count', 1)
    }
  }

  // Auto-apply best shop deal (stacks with platform offers below)
  let dealId: string | null = null
  let dealTitle: string | null = null
  let shopDealDiscount = 0
  if (!discountAmount) {
    // Only auto-apply shop deal when no promo code was used
    try {
      const { applyBestDeal } = await import('../deals/deals.routes')
      const dealResult = await applyBestDeal(data.shop_id, subtotal)
      if (dealResult.discount > 0) {
        shopDealDiscount = dealResult.discount
        discountAmount  += shopDealDiscount
        dealId           = dealResult.dealId
        dealTitle        = dealResult.dealTitle
      }
    } catch {}
  }

  // Apply best platform-wide offer on top of any shop deal (they stack)
  let platformDiscount = 0
  let platformTitle: string | null = null
  if (!data.promo_code) {
    // Promo codes are exclusive; platform offers only stack with shop deals
    try {
      const now = new Date()
      const platformOffers = await db('platform_offers')
        .where({ is_active: true })
        .where('valid_from', '<=', now)
        .where(function () {
          this.whereNull('valid_to').orWhere('valid_to', '>=', now)
        })
        .where('min_order', '<=', subtotal)
      for (const offer of platformOffers) {
        const val = parseFloat(offer.value)
        let disc = (offer.offer_type === 'percent' || offer.offer_type === 'percent_off')
          ? (subtotal * val) / 100
          : val
        if (offer.max_discount) disc = Math.min(disc, parseFloat(offer.max_discount))
        disc = Math.min(disc, subtotal)
        disc = Math.round(disc * 100) / 100
        if (disc > platformDiscount) {
          platformDiscount = disc
          platformTitle    = offer.title
        }
      }
      if (platformDiscount > 0) {
        discountAmount += platformDiscount
        // Combine labels: "Testing + Admin Portal Offer" or just the platform title
        dealTitle = [dealTitle, platformTitle].filter(Boolean).join(' + ')
      }
    } catch {}
  }

  const totalAmount = Math.max(0, subtotal + deliveryFee - discountAmount)

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
      ...(dealId && { deal_id: dealId, discount_source: 'deal' }),
      ...(data.promo_code && !dealId && { discount_source: 'promo_code' }),
    }).returning('*')

    // Increment deal usage
    if (dealId) {
      await trx('shop_deals').where({ id: dealId }).increment('uses_count', 1)
    }

    await trx('order_items').insert(
      orderItems.map(item => ({ ...item, order_id: newOrder.id }))
    )

    return newOrder
  })

  // Real-time broadcast to any connected shop portal tab
  const preview = orderItems.map(i => `${i.product_name} ×${i.quantity}`).join(', ')
  broadcast({
    type: 'order_created',
    shopId: data.shop_id,
    orderId: order.id,
    total: totalAmount,
    preview,
  })

  // Web push for when portal tab is closed (non-blocking)
  sendPushToShop(data.shop_id, {
    type: 'new_order',
    title: '🔔 New Order!',
    body: `${orderItems.length} item${orderItems.length !== 1 ? 's' : ''} — ₹${totalAmount}`,
    orderId: order.id,
  }).catch(() => {})

  return { order, delivery_otp: deliveryOtp }
}

export async function getOrder(orderId: string) {
  const order = await db('orders as o')
    .join('shops as s', 's.id', 'o.shop_id')
    .leftJoin('riders as r', 'r.id', 'o.rider_id')
    .where({ 'o.id': orderId })
    .select(
      'o.*',
      's.name as shop_name',
      db.raw('o.total_amount as total'),
      'r.name as rider_name',
      'r.phone as rider_phone',
      'r.vehicle_type as rider_vehicle',
    )
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
  const now = new Date()
  const timestamps: Record<string, any> = {
    confirmed:  { confirmed_at: now },
    assigned:   { assigned_at: now },
    picked_up:  { picked_up_at: now },
    delivered:  { delivered_at: now },
    cancelled:  { cancelled_at: now },
  }

  // Offer order to nearest available rider when shop confirms
  if (status === 'confirmed') {
    // Confirm the order first
    const [confirmed] = await db('orders')
      .where({ id: orderId })
      .update({ status: 'confirmed', confirmed_at: now, ...extra })
      .returning('*')

    broadcast({ type: 'order_updated', orderId, status: 'confirmed', shopId: confirmed?.shop_id })

    // Offer to nearest available rider (they must accept before it becomes 'assigned')
    const shop = await db('shops').where({ id: confirmed?.shop_id }).first()
    if (shop?.lat && shop?.lng) {
      const { offerOrderToRider } = await import('../riders/riders.service')
      const rider = await offerOrderToRider(orderId, confirmed.shop_id, parseFloat(shop.lat), parseFloat(shop.lng))

      // No riders available right now — retry every 30s for up to 5 minutes
      if (!rider) {
        let attempts = 0
        const maxAttempts = 10
        const retryInterval = setInterval(async () => {
          attempts++
          // Stop if order was assigned, cancelled, or max retries reached
          const current = await db('orders').where({ id: orderId }).first()
          if (!current || current.status !== 'confirmed' || attempts >= maxAttempts) {
            clearInterval(retryInterval)
            if (current?.status === 'confirmed' && attempts >= maxAttempts) {
              broadcast({ type: 'order_no_riders', orderId, shopId: confirmed.shop_id })
            }
            return
          }
          await offerOrderToRider(orderId, confirmed.shop_id, parseFloat(shop.lat), parseFloat(shop.lng))
        }, 30000)
      }
    }

    return confirmed
  }

  const [updated] = await db('orders')
    .where({ id: orderId })
    .update({ status, ...timestamps[status], ...extra })
    .returning('*')

  // Broadcast real-time status change to shop portal
  broadcast({ type: 'order_updated', orderId, status, shopId: updated?.shop_id })

  // Notify customer on cancellation
  if (status === 'cancelled') {
    const order = await db('orders').where({ id: orderId }).first()
    if (order?.customer_id) {
      sendPushToCustomer(order.customer_id, {
        title: '❌ Order Cancelled',
        body: 'Your order was cancelled by the shop. Tap to see details.',
        data: { orderId, type: 'order_cancelled' },
      }).catch(() => {})
    }
  }

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