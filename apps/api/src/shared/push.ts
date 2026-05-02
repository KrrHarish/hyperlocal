import * as webpush from 'web-push'
import { db } from './db/knex'

webpush.setVapidDetails(
  'mailto:admin@zuqu.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function sendPushToShop(shopId: string, payload: object) {
  const subs = await db('push_subscriptions').where({ shop_id: shopId })
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ).catch(async (err: any) => {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410) {
          await db('push_subscriptions').where({ endpoint: sub.endpoint }).delete()
        }
      })
    )
  )
}
