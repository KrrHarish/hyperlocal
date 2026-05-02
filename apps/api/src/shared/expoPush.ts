import { db } from './db/knex'

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: object
  sound?: 'default' | null
  badge?: number
}

export async function sendPushToCustomer(customerId: string, message: Omit<ExpoPushMessage, 'to'>) {
  const tokens = await db('customer_push_tokens').where({ customer_id: customerId }).pluck('token')
  if (!tokens.length) return

  const messages: ExpoPushMessage[] = tokens.map((token: string) => ({
    to: token,
    sound: 'default',
    ...message,
  }))

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
    const result = await res.json()
    console.log('[ExpoPush] result:', JSON.stringify(result))
  } catch (e) {
    console.error('[ExpoPush] failed:', e)
  }
}
