import { FastifyInstance } from 'fastify'
import { sendOTP, verifyOTP } from './auth.service'

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

}