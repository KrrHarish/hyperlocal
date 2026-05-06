import { FastifyInstance } from 'fastify'
import { sendOTP, verifyOTP } from './auth.service'
import { db } from '../../shared/db/knex'
import bcrypt from 'bcryptjs'

export async function authRoutes(server: FastifyInstance) {

  // POST /auth/otp/send
  server.post('/auth/otp/send', async (request, reply) => {
    const { phone } = request.body as { phone: string }

    if (!phone) {
      return reply.status(400).send({ error: 'Phone number is required' })
    }

    try {
      const otp = await sendOTP(phone)
      return reply.send({
        message: 'OTP sent successfully',
        otp, // remove this in production!
      })
    } catch (err: any) {
      return reply.status(429).send({ error: err.message })
    }
  })

  // POST /auth/otp/verify
  server.post('/auth/otp/verify', async (request, reply) => {
    const { phone, otp } = request.body as { phone: string; otp: string }

    if (!phone || !otp) {
      return reply.status(400).send({ error: 'Phone and OTP are required' })
    }

    try {
      const user = await verifyOTP(phone, otp)

      // Generate JWT token
      const token = server.jwt.sign(
        { id: user.id, phone: user.phone },
        { expiresIn: '30d' }
      )

      return reply.send({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
        },
      })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // POST /auth/shop/login — username + password set by admin
  server.post('/auth/shop/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    if (!username || !password) {
      return reply.status(400).send({ error: 'username and password are required' })
    }

    const cred = await db('shop_credentials as sc')
      .join('shops as s', 's.id', 'sc.shop_id')
      .where('sc.username', username.trim().toLowerCase())
      .select('sc.*', 's.name as shop_name', 's.is_active as shop_is_active')
      .first()

    if (!cred) return reply.status(401).send({ error: 'Invalid username or password' })
    if (!cred.is_active) return reply.status(403).send({ error: 'Account is disabled. Contact admin.' })
    if (!cred.shop_is_active) return reply.status(403).send({ error: 'Your shop has been suspended. Contact admin.' })

    const valid = await bcrypt.compare(password, cred.password_hash)
    if (!valid) return reply.status(401).send({ error: 'Invalid username or password' })

    const token = server.jwt.sign(
      { id: cred.shop_id, role: 'shop', username: cred.username },
      { expiresIn: '30d' }
    )
    return reply.send({ token, shop_id: cred.shop_id, shop_name: cred.shop_name })
  })

}