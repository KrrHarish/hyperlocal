import { FastifyInstance } from 'fastify'
import {
  registerRider,
  getRiderByPhone,
  toggleOnline,
  updateLocation,
  findNearestRiders,
  assignRiderToOrder,
  getRiderActiveOrder,
  getRiderEarnings,
} from './riders.service'

export async function riderRoutes(server: FastifyInstance) {

  // POST /riders/register — new rider signs up
  server.post('/riders/register', async (request, reply) => {
    const body = request.body as {
      phone: string
      name: string
      vehicle_type?: string
    }

    if (!body.phone || !body.name) {
      return reply.status(400).send({ error: 'phone and name are required' })
    }

    try {
      const rider = await registerRider({
        phone: body.phone,
        name: body.name,
        vehicle_type: body.vehicle_type || 'bike',
      })
      return reply.status(201).send({ message: 'Rider registered', rider })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // POST /riders/login — rider logs in with phone (reuse OTP auth)
  server.post('/riders/login', async (request, reply) => {
    const { phone } = request.body as { phone: string }
    const rider = await getRiderByPhone(phone)
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    if (rider.is_suspended) {
      return reply.status(403).send({ error: 'Account suspended' })
    }

    const token = server.jwt.sign(
      { id: rider.id, phone: rider.phone, role: 'rider' },
      { expiresIn: '30d' }
    )

    return reply.send({ message: 'Login successful', token, rider })
  })

  // POST /riders/toggle-online — go online or offline
  server.post('/riders/toggle-online', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { is_online, lat, lng } = request.body as {
      is_online: boolean
      lat?: number
      lng?: number
    }

    if (is_online && (!lat || !lng)) {
      return reply.status(400).send({ error: 'lat and lng required when going online' })
    }

    const rider = await toggleOnline(user.id, is_online, lat, lng)
    return reply.send({
      message: is_online ? 'You are now online' : 'You are now offline',
      rider
    })
  })

  // POST /riders/location — update live location
  server.post('/riders/location', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { lat, lng } = request.body as { lat: number; lng: number }

    if (!lat || !lng) return reply.status(400).send({ error: 'lat and lng required' })

    await updateLocation(user.id, lat, lng)
    return reply.send({ message: 'Location updated' })
  })

  // GET /riders/nearby?lat=12.9&lng=77.6&radius=2 — find nearby riders (ops use)
  server.get('/riders/nearby', async (request, reply) => {
    const { lat, lng, radius } = request.query as {
      lat: string; lng: string; radius?: string
    }

    if (!lat || !lng) return reply.status(400).send({ error: 'lat and lng required' })

    const riders = await findNearestRiders(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 2
    )

    return reply.send({ riders, count: riders.length })
  })

  // POST /riders/orders/:orderId/accept — rider accepts an order
  server.post('/riders/orders/:orderId/accept', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const { orderId } = request.params as { orderId: string }

    try {
      const order = await assignRiderToOrder(orderId, user.id)
      return reply.send({ message: 'Order accepted', order })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // GET /riders/orders/active — rider's current active order
  server.get('/riders/orders/active', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const order = await getRiderActiveOrder(user.id)
    return reply.send({ order: order || null })
  })

  // GET /riders/earnings — rider's earnings summary
  server.get('/riders/earnings', async (request, reply) => {
    try { await request.jwtVerify() } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = request.user as { id: string }
    const earnings = await getRiderEarnings(user.id)
    return reply.send({ earnings })
  })
}