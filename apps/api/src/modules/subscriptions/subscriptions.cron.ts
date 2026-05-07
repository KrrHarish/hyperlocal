import { db } from '../../shared/db/knex'
import { placeOrder } from '../orders/orders.service'

function computeNextRun(frequency: string, dayOfWeek?: number | null): Date {
  const now = new Date()
  switch (frequency) {
    case 'daily':    return new Date(now.getTime() + 24 * 3600 * 1000)
    case 'weekly': {
      const target = dayOfWeek ?? now.getDay()
      const daysUntil = (target - now.getDay() + 7) % 7 || 7
      return new Date(now.getTime() + daysUntil * 24 * 3600 * 1000)
    }
    case 'biweekly': return new Date(now.getTime() + 14 * 24 * 3600 * 1000)
    case 'monthly':  return new Date(now.getTime() + 30 * 24 * 3600 * 1000)
    default:         return new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  }
}

async function processDueSubscriptions() {
  const now = new Date()
  const due = await db('subscriptions')
    .where({ is_active: true })
    .where('next_run_at', '<=', now)

  for (const sub of due) {
    try {
      const items = await db('subscription_items').where({ subscription_id: sub.id })
      if (!items.length) continue

      const shop = await db('shops').where({ id: sub.shop_id, is_active: true, is_open: true }).first()
      if (!shop) {
        console.log(`[sub-cron] Skipping ${sub.id} — shop closed/suspended`)
        continue
      }

      await placeOrder(sub.customer_id, {
        shop_id: sub.shop_id,
        items: items.map((i: any) => ({ shop_product_id: i.shop_product_id, quantity: i.quantity })),
        delivery_address: typeof sub.delivery_address === 'string'
          ? JSON.parse(sub.delivery_address)
          : sub.delivery_address,
      })

      // Advance next_run_at
      const nextRunAt = computeNextRun(sub.frequency, sub.day_of_week)
      await db('subscriptions').where({ id: sub.id }).update({ next_run_at: nextRunAt, updated_at: new Date() })
      console.log(`[sub-cron] ✓ Subscription ${sub.id} order placed. Next: ${nextRunAt.toISOString()}`)
    } catch (err: any) {
      console.error(`[sub-cron] ✗ Failed for subscription ${sub.id}:`, err.message)
      // Don't advance next_run_at on failure — retry next cycle
    }
  }
}

export function startSubscriptionCron() {
  // Run immediately on boot, then every 15 minutes
  processDueSubscriptions().catch(() => {})
  setInterval(() => processDueSubscriptions().catch(() => {}), 15 * 60 * 1000)
  console.log('[sub-cron] Subscription cron started (15-min interval)')
}
