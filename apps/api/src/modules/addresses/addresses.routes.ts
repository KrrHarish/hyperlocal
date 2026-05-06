import { FastifyInstance } from 'fastify'
import { db } from '../../shared/db/knex'

export async function addressRoutes(server: FastifyInstance) {

  async function requireCustomer(request: any, reply: any): Promise<string | null> {
    try {
      await request.jwtVerify()
      return (request.user as { id: string }).id
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
      return null
    }
  }

  // GET /addresses — list customer's saved addresses
  server.get('/addresses', async (request, reply) => {
    const customerId = await requireCustomer(request, reply)
    if (!customerId) return

    const addresses = await db('saved_addresses')
      .where({ customer_id: customerId })
      .orderBy([{ column: 'is_default', order: 'desc' }, { column: 'created_at', order: 'desc' }])

    return reply.send({ addresses })
  })

  // POST /addresses — create a new saved address
  server.post('/addresses', async (request, reply) => {
    const customerId = await requireCustomer(request, reply)
    if (!customerId) return

    const { label, full_address, lat, lng, is_default } = request.body as {
      label: string
      full_address: string
      lat: number
      lng: number
      is_default?: boolean
    }

    if (!label || !full_address || lat === undefined || lng === undefined) {
      return reply.status(400).send({ error: 'label, full_address, lat, lng are required' })
    }

    const makeDefault = is_default === true

    if (makeDefault) {
      await db('saved_addresses')
        .where({ customer_id: customerId })
        .update({ is_default: false })
    }

    const [address] = await db('saved_addresses').insert({
      customer_id: customerId,
      label,
      full_address,
      lat,
      lng,
      is_default: makeDefault,
    }).returning('*')

    return reply.status(201).send({ address })
  })

  // PATCH /addresses/:id — update an address
  server.patch('/addresses/:id', async (request, reply) => {
    const customerId = await requireCustomer(request, reply)
    if (!customerId) return

    const { id } = request.params as { id: string }
    const existing = await db('saved_addresses').where({ id, customer_id: customerId }).first()
    if (!existing) return reply.status(404).send({ error: 'Address not found' })

    const { label, full_address, lat, lng, is_default } = request.body as {
      label?: string
      full_address?: string
      lat?: number
      lng?: number
      is_default?: boolean
    }

    if (is_default === true) {
      await db('saved_addresses')
        .where({ customer_id: customerId })
        .whereNot({ id })
        .update({ is_default: false })
    }

    const updates: Record<string, any> = { updated_at: new Date() }
    if (label !== undefined) updates.label = label
    if (full_address !== undefined) updates.full_address = full_address
    if (lat !== undefined) updates.lat = lat
    if (lng !== undefined) updates.lng = lng
    if (is_default !== undefined) updates.is_default = is_default

    const [address] = await db('saved_addresses').where({ id }).update(updates).returning('*')
    return reply.send({ address })
  })

  // DELETE /addresses/:id — delete an address
  server.delete('/addresses/:id', async (request, reply) => {
    const customerId = await requireCustomer(request, reply)
    if (!customerId) return

    const { id } = request.params as { id: string }
    const existing = await db('saved_addresses').where({ id, customer_id: customerId }).first()
    if (!existing) return reply.status(404).send({ error: 'Address not found' })

    await db('saved_addresses').where({ id }).delete()
    return reply.send({ ok: true })
  })

  // PATCH /addresses/:id/default — set as default
  server.patch('/addresses/:id/default', async (request, reply) => {
    const customerId = await requireCustomer(request, reply)
    if (!customerId) return

    const { id } = request.params as { id: string }
    const existing = await db('saved_addresses').where({ id, customer_id: customerId }).first()
    if (!existing) return reply.status(404).send({ error: 'Address not found' })

    // Unset all others
    await db('saved_addresses')
      .where({ customer_id: customerId })
      .update({ is_default: false })

    const [address] = await db('saved_addresses')
      .where({ id })
      .update({ is_default: true, updated_at: new Date() })
      .returning('*')

    return reply.send({ address })
  })
}
