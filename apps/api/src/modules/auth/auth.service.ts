import { redis } from '../../shared/redis'
import { db } from '../../shared/db/knex'

// Generate a 6-digit OTP and store in Redis for 5 minutes
export async function sendOTP(phone: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const key = `otp:${phone}`

  // Check rate limit — max 3 OTPs per phone per 10 minutes
  const attempts = await redis.incr(`otp_attempts:${phone}`)
  if (attempts === 1) await redis.expire(`otp_attempts:${phone}`, 600)
  if (attempts > 3) throw new Error('Too many OTP requests. Try again in 10 minutes.')

  // Store OTP with 5 minute expiry
  await redis.set(key, otp, 'EX', 300)

  // In production: send via SMS. For prototype: return in response.
  console.log(`OTP for ${phone}: ${otp}`)

  return otp
}

// Verify OTP and return or create the user
export async function verifyOTP(phone: string, otp: string) {
  const key = `otp:${phone}`
  const stored = await redis.get(key)

  if (!stored) throw new Error('OTP expired. Please request a new one.')
  if (stored !== otp) throw new Error('Invalid OTP.')

  // Delete OTP after use — single use only
  await redis.del(key)

  // Find or create user
  let user = await db('users').where({ phone }).first()

  if (!user) {
    const [newUser] = await db('users')
      .insert({ phone })
      .returning('*')
    user = newUser
  }

  return user
}