import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { db } from '../../shared/db/knex'
import { seedShopCatalogue } from '../products/defaultCatalogue'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function adminRoutes(server: FastifyInstance) {

  // ── Auth helper ──────────────────────────────────────────────────────────────

  async function requireAdmin(request: any, reply: any): Promise<boolean> {
    try {
      await request.jwtVerify()
      const user = request.user as { role?: string }
      if (user.role !== 'admin') {
        reply.status(403).send({ error: 'Forbidden' })
        return false
      }
      return true
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
      return false
    }
  }

  // ── POST /admin/login ────────────────────────────────────────────────────────

  server.post('/admin/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' })
    }

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = server.jwt.sign({ role: 'admin', email }, { expiresIn: '7d' })
    return reply.send({ token })
  })

  // ── GET /admin/stats ─────────────────────────────────────────────────────────

  server.get('/admin/stats', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { from: fromStr, to: toStr } = request.query as { from?: string; to?: string }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Date range for filtered stats (defaults to all-time if not provided)
    let fromDate: Date | undefined
    let toDate:   Date | undefined
    if (fromStr) { fromDate = new Date(fromStr); fromDate.setHours(0, 0, 0, 0) }
    if (toStr)   { toDate   = new Date(toStr);   toDate.setHours(23, 59, 59, 999) }

    // Base query scoped to the date range
    function scopedOrders() {
      let q = db('orders')
      if (fromDate) q = q.where('created_at', '>=', fromDate)
      if (toDate)   q = q.where('created_at', '<=', toDate)
      return q
    }

    const [
      ordersInRangeRow,
      ordersTodayRow,
      revenueInRangeRow,
      revenueTodayRow,
      totalRidersRow,
      activeRidersRow,
      totalShopsRow,
      totalCustomersRow,
      ordersByStatus,
      dailyRevenue,
    ] = await Promise.all([
      scopedOrders().count('id as count').first(),
      db('orders').where('created_at', '>=', todayISO).count('id as count').first(),
      scopedOrders().where('status', 'delivered').sum('total_amount as total').first(),
      db('orders').where('status', 'delivered').where('delivered_at', '>=', todayISO).sum('total_amount as total').first(),
      db('riders').count('id as count').first(),
      db('riders').where('is_online', true).count('id as count').first(),
      db('shops').count('id as count').first(),
      db('users').count('id as count').first(),
      scopedOrders().select('status').count('id as count').groupBy('status'),
      // Daily revenue trend for the range
      scopedOrders()
        .where('status', 'delivered')
        .select(db.raw("DATE(created_at) as date"))
        .sum('total_amount as revenue')
        .count('id as orders')
        .groupByRaw("DATE(created_at)")
        .orderBy('date', 'asc'),
    ])

    const statusMap: Record<string, number> = {
      pending: 0, confirmed: 0, assigned: 0,
      picked_up: 0, delivered: 0, cancelled: 0,
    }
    for (const row of ordersByStatus as any[]) {
      const s = row.status as string
      if (s in statusMap) statusMap[s] = Number(row.count)
    }

    return reply.send({
      total_orders:    Number(ordersInRangeRow?.count  ?? 0),
      orders_today:    Number(ordersTodayRow?.count    ?? 0),
      total_revenue:   Number(revenueInRangeRow?.total ?? 0),
      revenue_today:   Number(revenueTodayRow?.total   ?? 0),
      total_riders:    Number(totalRidersRow?.count    ?? 0),
      active_riders:   Number(activeRidersRow?.count   ?? 0),
      total_shops:     Number(totalShopsRow?.count     ?? 0),
      total_customers: Number(totalCustomersRow?.count ?? 0),
      orders_by_status: statusMap,
      daily_revenue: (dailyRevenue as any[]).map(d => ({
        date:    d.date,
        revenue: Number(d.revenue),
        orders:  Number(d.orders),
      })),
      // Surface the active filter so the UI can show it
      filter: { from: fromStr ?? null, to: toStr ?? null },
    })
  })

  // ── GET /admin/orders ────────────────────────────────────────────────────────

  server.get('/admin/orders', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const {
      status,
      from,
      to,
      search,
      page = '1',
      limit = '20',
    } = request.query as {
      status?: string
      from?: string
      to?: string
      search?: string
      page?: string
      limit?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    let query = db('orders as o')
      .leftJoin('shops as s', 's.id', 'o.shop_id')
      .leftJoin('riders as r', 'r.id', 'o.rider_id')
      .leftJoin('users as u', 'u.id', 'o.customer_id')
      .select(
        'o.id',
        'o.order_number',
        'o.status',
        'o.total_amount',
        'o.delivery_fee',
        'o.created_at',
        'o.delivered_at',
        's.name as shop_name',
        'r.name as rider_name',
        'u.phone as customer_phone',
        'u.name as customer_name',
      )
      .orderBy('o.created_at', 'desc')

    if (status) query = query.where('o.status', status)
    if (from) query = query.where('o.created_at', '>=', new Date(from).toISOString())
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      query = query.where('o.created_at', '<=', toDate.toISOString())
    }
    if (search) {
      query = query.where(function () {
        this.whereILike('o.order_number', `%${search}%`)
          .orWhereILike('s.name', `%${search}%`)
          .orWhereILike('u.phone', `%${search}%`)
          .orWhereILike('r.name', `%${search}%`)
      })
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('o.id as count').first()
    const [orders, countRow] = await Promise.all([
      query.limit(limitNum).offset(offset),
      countQuery,
    ])

    const total = Number(countRow?.count ?? 0)
    const pages = Math.ceil(total / limitNum)

    return reply.send({ orders, total, page: pageNum, pages })
  })

  // ── GET /admin/riders/live — online riders with freshest coords from Redis ───

  server.get('/admin/riders/live', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { redis } = await import('../../shared/redis')

    const onlineRiders = await db('riders')
      .where({ is_online: true, is_suspended: false })
      .select('id', 'name', 'phone', 'vehicle_type', 'lat', 'lng', 'trust_score')

    // Enrich with freshest coords from Redis
    const enriched = await Promise.all(onlineRiders.map(async (r: any) => {
      try {
        const cached = await redis.get(`rider_location:${r.id}`)
        if (cached) {
          const { lat, lng } = JSON.parse(cached)
          return { ...r, lat, lng, source: 'redis' }
        }
      } catch {}
      return { ...r, source: 'db' }
    }))

    // Only return riders that actually have coordinates
    return reply.send({ riders: enriched.filter((r: any) => r.lat && r.lng) })
  })

  // ── GET /admin/riders ────────────────────────────────────────────────────────

  server.get('/admin/riders', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const {
      search,
      page = '1',
      limit = '20',
    } = request.query as { search?: string; page?: string; limit?: string }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    let query = db('riders as r')
      .leftJoin(
        db('orders')
          .where('status', 'delivered')
          .select('rider_id')
          .count('id as total_deliveries')
          .sum('delivery_fee as total_earned')
          .groupBy('rider_id')
          .as('stats'),
        'stats.rider_id',
        'r.id',
      )
      .select(
        'r.*',
        db.raw('COALESCE(stats.total_deliveries, 0) as total_deliveries'),
        db.raw('COALESCE(stats.total_earned, 0) as total_earned'),
      )
      .orderBy('r.created_at', 'desc')

    if (search) {
      query = query.where(function () {
        this.whereILike('r.name', `%${search}%`).orWhereILike('r.phone', `%${search}%`)
      })
    }

    const countQuery = db('riders as r').modify((q: any) => {
      if (search) {
        q.where(function (this: any) {
          this.whereILike('r.name', `%${search}%`).orWhereILike('r.phone', `%${search}%`)
        })
      }
    }).count('id as count').first()

    const [riders, countRow] = await Promise.all([
      query.limit(limitNum).offset(offset),
      countQuery,
    ])

    const total = Number(countRow?.count ?? 0)
    const pages = Math.ceil(total / limitNum)

    return reply.send({ riders, total, pages })
  })

  // ── GET /admin/riders/:id ────────────────────────────────────────────────────

  server.get('/admin/riders/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }

    const [rider, earningsRow, recentOrders] = await Promise.all([
      db('riders').where('id', id).first(),
      db('orders')
        .where({ rider_id: id, status: 'delivered' })
        .select(
          db.raw('COUNT(id) as total_deliveries'),
          db.raw('SUM(delivery_fee) as total_earned'),
          db.raw('AVG(delivery_fee) as avg_per_delivery'),
        )
        .first(),
      db('orders as o')
        .leftJoin('shops as s', 's.id', 'o.shop_id')
        .leftJoin('users as u', 'u.id', 'o.customer_id')
        .where({ 'o.rider_id': id, 'o.status': 'delivered' })
        .select(
          'o.id',
          'o.order_number',
          'o.total_amount',
          'o.delivery_fee',
          'o.delivered_at',
          'o.created_at',
          's.name as shop_name',
          'u.phone as customer_phone',
        )
        .orderBy('o.delivered_at', 'desc')
        .limit(20),
    ])

    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    return reply.send({
      rider,
      earnings: {
        total_deliveries: Number(earningsRow?.total_deliveries ?? 0),
        total_earned: Number(earningsRow?.total_earned ?? 0),
        avg_per_delivery: Number(earningsRow?.avg_per_delivery ?? 0),
      },
      recent_orders: recentOrders,
    })
  })

  // ── GET /admin/shops ─────────────────────────────────────────────────────────

  server.get('/admin/shops', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const {
      search,
      page = '1',
      limit = '20',
    } = request.query as { search?: string; page?: string; limit?: string }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    let query = db('shops as s')
      .leftJoin(
        db('orders')
          .where('status', 'delivered')
          .select('shop_id')
          .count('id as total_orders')
          .sum('total_amount as total_revenue')
          .avg('total_amount as avg_order_value')
          .groupBy('shop_id')
          .as('stats'),
        'stats.shop_id',
        's.id',
      )
      .select(
        's.*',
        db.raw('COALESCE(stats.total_orders, 0) as total_orders'),
        db.raw('COALESCE(stats.total_revenue, 0) as total_revenue'),
        db.raw('COALESCE(stats.avg_order_value, 0) as avg_order_value'),
      )
      .orderBy('s.created_at', 'desc')

    if (search) {
      query = query.where(function () {
        this.whereILike('s.name', `%${search}%`).orWhereILike('s.phone', `%${search}%`)
      })
    }

    const countQuery = db('shops as s').modify((q: any) => {
      if (search) {
        q.where(function (this: any) {
          this.whereILike('s.name', `%${search}%`).orWhereILike('s.phone', `%${search}%`)
        })
      }
    }).count('id as count').first()

    const [shops, countRow] = await Promise.all([
      query.limit(limitNum).offset(offset),
      countQuery,
    ])

    const total = Number(countRow?.count ?? 0)
    const pages = Math.ceil(total / limitNum)

    return reply.send({ shops, total, pages })
  })

  // ── GET /admin/shops/:id ─────────────────────────────────────────────────────

  server.get('/admin/shops/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }

    const [shop, revenueRow, recentOrders] = await Promise.all([
      db('shops').where('id', id).first(),
      db('orders')
        .where({ shop_id: id, status: 'delivered' })
        .select(
          db.raw('COUNT(id) as total_orders'),
          db.raw('SUM(total_amount) as total_revenue'),
          db.raw('AVG(total_amount) as avg_order_value'),
        )
        .first(),
      db('orders as o')
        .leftJoin('users as u', 'u.id', 'o.customer_id')
        .leftJoin('riders as r', 'r.id', 'o.rider_id')
        .where('o.shop_id', id)
        .select(
          'o.id',
          'o.order_number',
          'o.status',
          'o.total_amount',
          'o.delivery_fee',
          'o.created_at',
          'o.delivered_at',
          'u.phone as customer_phone',
          'r.name as rider_name',
        )
        .orderBy('o.created_at', 'desc')
        .limit(20),
    ])

    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    return reply.send({
      shop,
      revenue: {
        total_orders: Number(revenueRow?.total_orders ?? 0),
        total_revenue: Number(revenueRow?.total_revenue ?? 0),
        avg_order_value: Number(revenueRow?.avg_order_value ?? 0),
      },
      recent_orders: recentOrders,
    })
  })

  // ── GET /admin/customers ─────────────────────────────────────────────────────

  server.get('/admin/customers', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const {
      search,
      page = '1',
      limit = '20',
    } = request.query as { search?: string; page?: string; limit?: string }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    let query = db('users as u')
      .leftJoin(
        db('orders')
          .select('customer_id')
          .count('id as order_count')
          .sum('total_amount as total_spent')
          .groupBy('customer_id')
          .as('stats'),
        'stats.customer_id',
        'u.id',
      )
      .select(
        'u.id',
        'u.phone',
        'u.name',
        'u.created_at',
        db.raw('COALESCE(stats.order_count, 0) as order_count'),
        db.raw('COALESCE(stats.total_spent, 0) as total_spent'),
      )
      .orderBy('u.created_at', 'desc')

    if (search) {
      query = query.where(function () {
        this.whereILike('u.phone', `%${search}%`).orWhereILike('u.name', `%${search}%`)
      })
    }

    const countQuery = db('users as u').modify((q: any) => {
      if (search) {
        q.where(function (this: any) {
          this.whereILike('u.phone', `%${search}%`).orWhereILike('u.name', `%${search}%`)
        })
      }
    }).count('id as count').first()

    const [customers, countRow] = await Promise.all([
      query.limit(limitNum).offset(offset),
      countQuery,
    ])

    const total = Number(countRow?.count ?? 0)
    const pages = Math.ceil(total / limitNum)

    return reply.send({ customers, total, pages })
  })

  // ── GET /admin/customers/:id ─────────────────────────────────────────────────

  server.get('/admin/customers/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }

    const [customer, spendRow, recentOrders] = await Promise.all([
      db('users').where('id', id).select('id', 'phone', 'name', 'created_at').first(),
      db('orders')
        .where('customer_id', id)
        .select(
          db.raw('COUNT(id) as order_count'),
          db.raw('SUM(total_amount) as total_spent'),
        )
        .first(),
      db('orders as o')
        .leftJoin('shops as s', 's.id', 'o.shop_id')
        .where('o.customer_id', id)
        .select(
          'o.id',
          'o.order_number',
          'o.status',
          'o.total_amount',
          'o.delivery_fee',
          'o.created_at',
          'o.delivered_at',
          's.name as shop_name',
        )
        .orderBy('o.created_at', 'desc')
        .limit(20),
    ])

    if (!customer) return reply.status(404).send({ error: 'Customer not found' })

    return reply.send({
      customer,
      summary: {
        order_count: Number(spendRow?.order_count ?? 0),
        total_spent: Number(spendRow?.total_spent ?? 0),
      },
      recent_orders: recentOrders,
    })
  })

  // ── PATCH /admin/riders/:id/suspend — toggle rider suspension ────────────────

  server.patch('/admin/riders/:id/suspend', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }
    const rider = await db('riders').where({ id }).first()
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    const [updated] = await db('riders')
      .where({ id })
      .update({ is_suspended: !rider.is_suspended, updated_at: new Date() })
      .returning('*')

    return reply.send({ rider: updated })
  })

  // ── PATCH /admin/riders/:id/verify — toggle rider verification ───────────────

  server.patch('/admin/riders/:id/verify', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }
    const rider = await db('riders').where({ id }).first()
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    const [updated] = await db('riders')
      .where({ id })
      .update({ is_verified: !rider.is_verified, updated_at: new Date() })
      .returning('*')

    return reply.send({ rider: updated })
  })

  // ── PATCH /admin/riders/:id/wallet — credit or debit rider wallet ────────────

  server.patch('/admin/riders/:id/wallet', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { id } = request.params as { id: string }
    const { amount, note } = request.body as { amount: number; note?: string }

    if (amount === undefined || isNaN(Number(amount))) {
      return reply.status(400).send({ error: 'amount is required' })
    }

    const rider = await db('riders').where({ id }).first()
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    const newBalance = parseFloat(rider.wallet_balance) + Number(amount)
    const [updated] = await db('riders')
      .where({ id })
      .update({ wallet_balance: newBalance, updated_at: new Date() })
      .returning('*')

    return reply.send({ rider: updated, note: note ?? null })
  })

  // ── GET /admin/export/orders — export orders as CSV ─────────────────────────

  server.get('/admin/export/orders', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { from, to, status } = request.query as { from?: string; to?: string; status?: string }

    let query = db('orders as o')
      .leftJoin('shops as s', 's.id', 'o.shop_id')
      .leftJoin('users as u', 'u.id', 'o.customer_id')
      .leftJoin('riders as r', 'r.id', 'o.rider_id')
      .select(
        'o.order_number',
        's.name as shop_name',
        'u.phone as customer_phone',
        'r.name as rider_name',
        'o.status',
        'o.total_amount',
        'o.delivery_fee',
        'o.created_at',
        'o.delivered_at',
      )
      .orderBy('o.created_at', 'desc')

    if (status) query = query.where('o.status', status)
    if (from) query = query.where('o.created_at', '>=', new Date(from).toISOString())
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      query = query.where('o.created_at', '<=', toDate.toISOString())
    }

    const orders = await query

    const header = 'Order#,Shop,Customer Phone,Rider,Status,Total,Delivery Fee,Placed At,Delivered At'
    const rows = orders.map((o: any) => [
      o.order_number ?? '',
      `"${(o.shop_name ?? '').replace(/"/g, '""')}"`,
      o.customer_phone ?? '',
      `"${(o.rider_name ?? '').replace(/"/g, '""')}"`,
      o.status ?? '',
      o.total_amount ?? '',
      o.delivery_fee ?? '',
      o.created_at ? new Date(o.created_at).toISOString() : '',
      o.delivered_at ? new Date(o.delivered_at).toISOString() : '',
    ].join(','))

    const csv = [header, ...rows].join('\n')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', 'attachment; filename="orders.csv"')
    return reply.send(csv)
  })

  // ── GET /admin/export/riders — export riders as CSV ──────────────────────────

  server.get('/admin/export/riders', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const riders = await db('riders as r')
      .leftJoin(
        db('orders')
          .where('status', 'delivered')
          .select('rider_id')
          .count('id as total_deliveries')
          .sum('delivery_fee as total_earned')
          .groupBy('rider_id')
          .as('stats'),
        'stats.rider_id',
        'r.id',
      )
      .select(
        'r.name',
        'r.phone',
        'r.vehicle_type',
        db.raw("CASE WHEN r.is_online THEN 'Online' ELSE 'Offline' END as online_status"),
        db.raw("CASE WHEN r.is_verified THEN 'Yes' ELSE 'No' END as verified"),
        db.raw('COALESCE(stats.total_deliveries, 0) as total_deliveries'),
        db.raw('COALESCE(stats.total_earned, 0) as total_earned'),
        'r.wallet_balance',
        'r.trust_score',
      )
      .orderBy('r.created_at', 'desc')

    const header = 'Name,Phone,Vehicle,Status,Verified,Deliveries,Total Earned,Wallet,Trust Score'
    const rows = (riders as any[]).map(r => [
      `"${(r.name ?? '').replace(/"/g, '""')}"`,
      r.phone ?? '',
      r.vehicle_type ?? '',
      r.online_status ?? '',
      r.verified ?? '',
      r.total_deliveries ?? 0,
      r.total_earned ?? 0,
      r.wallet_balance ?? 0,
      r.trust_score ?? 0,
    ].join(','))

    const csv = [header, ...rows].join('\n')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', 'attachment; filename="riders.csv"')
    return reply.send(csv)
  })

  // ── POST /admin/shops — create a shop + credentials in one go ────────────────

  server.post('/admin/shops', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { name, category, address, lat, lng, phone, username, password } = request.body as any

    if (!name || !category || !address || !username || !password) {
      return reply.status(400).send({ error: 'name, category, address, username and password are required' })
    }

    // Check username uniqueness
    const existing = await db('shop_credentials').where({ username: username.trim().toLowerCase() }).first()
    if (existing) return reply.status(400).send({ error: 'Username already taken' })

    const password_hash = await bcrypt.hash(password, 10)

    const [shop] = await db('shops')
      .insert({ name, category, address, lat: lat ?? null, lng: lng ?? null, phone: phone ?? null, is_active: true, is_open: false })
      .returning('*')

    await db('shop_credentials').insert({
      shop_id: shop.id,
      username: username.trim().toLowerCase(),
      password_hash,
    })

    // Seed default catalogue based on shop category (non-blocking — don't fail shop creation if this errors)
    seedShopCatalogue(shop.id, shop.category).catch(err =>
      console.error(`[defaultCatalogue] Failed to seed shop ${shop.id}:`, err)
    )

    return reply.status(201).send({ shop, username: username.trim().toLowerCase() })
  })

  // ── PATCH /admin/shops/:id — update shop details ─────────────────────────────

  server.patch('/admin/shops/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    const { name, category, address, lat, lng, phone, is_open } = request.body as any

    const shop = await db('shops').where({ id }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    const [updated] = await db('shops')
      .where({ id })
      .update({
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(address !== undefined && { address }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(phone !== undefined && { phone }),
        ...(is_open !== undefined && { is_open }),
        updated_at: new Date(),
      })
      .returning('*')

    return reply.send({ shop: updated })
  })

  // ── PATCH /admin/shops/:id/suspend — toggle shop active status ───────────────

  server.patch('/admin/shops/:id/suspend', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    const shop = await db('shops').where({ id }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    const [updated] = await db('shops')
      .where({ id })
      .update({ is_active: !shop.is_active, updated_at: new Date() })
      .returning('*')

    return reply.send({ shop: updated })
  })

  // ── POST /admin/shops/:id/seed-catalogue — seed default products for a shop ────

  server.post('/admin/shops/:id/seed-catalogue', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }

    const shop = await db('shops').where({ id }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    await seedShopCatalogue(shop.id, shop.category)

    const count = await db('shop_products').where({ shop_id: id, is_visible: true }).count('id as n').first()
    return reply.send({ seeded: true, product_count: Number(count?.n ?? 0) })
  })

  // ── POST /admin/shops/:id/image — upload shop logo ────────────────────────────

  server.post('/admin/shops/:id/image', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }

    const shop = await db('shops').where({ id }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext      = path.extname(data.filename).toLowerCase() || '.jpg'
    const filename = `shop-${id}${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    await pipeline(data.file, fs.createWriteStream(filepath))

    const image_url = `/uploads/${filename}`
    await db('shops').where({ id }).update({ image_url, updated_at: new Date() })

    return reply.send({ image_url })
  })

  // ── GET /admin/shops/:id/credentials — get shop login username (no password) ──

  server.get('/admin/shops/:id/credentials', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    const cred = await db('shop_credentials').where({ shop_id: id }).first()
    return reply.send({ username: cred?.username ?? null, is_active: cred?.is_active ?? false })
  })

  // ── POST /admin/shops/:id/credentials — set or reset shop credentials ─────────

  server.post('/admin/shops/:id/credentials', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    const { username, password } = request.body as { username: string; password: string }
    if (!username || !password) return reply.status(400).send({ error: 'username and password are required' })

    const shop = await db('shops').where({ id }).first()
    if (!shop) return reply.status(404).send({ error: 'Shop not found' })

    // Check username not taken by another shop
    const taken = await db('shop_credentials')
      .where({ username: username.trim().toLowerCase() })
      .whereNot({ shop_id: id })
      .first()
    if (taken) return reply.status(400).send({ error: 'Username already taken by another shop' })

    const password_hash = await bcrypt.hash(password, 10)

    await db('shop_credentials')
      .insert({ shop_id: id, username: username.trim().toLowerCase(), password_hash, is_active: true })
      .onConflict('shop_id')
      .merge({ username: username.trim().toLowerCase(), password_hash, is_active: true, updated_at: new Date() })

    return reply.send({ ok: true, username: username.trim().toLowerCase() })
  })

  // ── GET /admin/riders/online — list all online (available) riders ────────────

  server.get('/admin/riders/online', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const riders = await db('riders')
      .where({ is_online: true, is_suspended: false })
      .select('id', 'name', 'phone', 'vehicle_type', 'lat', 'lng')
      .orderBy('name', 'asc')

    return reply.send({ riders })
  })

  // ── POST /admin/orders/:orderId/assign — force-assign a rider to an order ────

  server.post('/admin/orders/:orderId/assign', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    const { orderId } = request.params as { orderId: string }
    const { rider_id } = request.body as { rider_id: string }

    if (!rider_id) return reply.status(400).send({ error: 'rider_id is required' })

    const [order, rider] = await Promise.all([
      db('orders').where({ id: orderId }).first(),
      db('riders').where({ id: rider_id }).first(),
    ])

    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (!rider) return reply.status(404).send({ error: 'Rider not found' })

    const assignable = ['pending', 'confirmed', 'assigned']
    if (!assignable.includes(order.status)) {
      return reply.status(400).send({
        error: `Cannot assign a rider to an order with status "${order.status}"`,
      })
    }

    const [updated] = await db('orders')
      .where({ id: orderId })
      .update({ rider_id, status: 'assigned', assigned_at: new Date(), updated_at: new Date() })
      .returning('*')

    // Notify the rider's app — triggers the incoming order card + chime
    const { broadcast } = await import('../../shared/realtime')
    broadcast({
      type:        'order_offered',
      riderId:     rider_id,
      orderId,
      shopId:      updated.shop_id,
      shopName:    order.shop_name,
      total:       updated.total_amount,
      deliveryFee: updated.delivery_fee,
      preview:     '',
    })
    broadcast({ type: 'order_assigned', orderId, riderId: rider_id, shopId: updated.shop_id })
    broadcast({ type: 'order_updated',  orderId, status: 'assigned', shopId: updated.shop_id })

    return reply.send({ ok: true, order: updated })
  })

  // ── POST /admin/riders — admin creates a rider directly ──────────────────────

  server.post('/admin/riders', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { name, phone, vehicle_type } = request.body as any
    if (!name || !phone || !vehicle_type) {
      return reply.status(400).send({ error: 'name, phone, and vehicle_type are required' })
    }

    const existing = await db('riders').where({ phone }).first()
    if (existing) return reply.status(400).send({ error: 'A rider with this phone number already exists' })

    const [rider] = await db('riders')
      .insert({ name, phone, vehicle_type, is_verified: true })
      .returning('*')

    return reply.status(201).send({ rider })
  })

  // ── GET /platform-offers — public: active platform offers ────────────────────
  server.get('/platform-offers', async (_request, reply) => {
    const now = new Date()
    const offers = await db('platform_offers')
      .where({ is_active: true })
      .where('valid_from', '<=', now)
      .where(function () {
        this.whereNull('valid_to').orWhere('valid_to', '>=', now)
      })
      .orderBy('created_at', 'asc')
    return reply.send({ offers })
  })

  // ── GET /admin/platform-offers — list all (admin) ────────────────────────────
  server.get('/admin/platform-offers', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const offers = await db('platform_offers').orderBy('created_at', 'desc')
    return reply.send({ offers })
  })

  // ── POST /admin/platform-offers — create ─────────────────────────────────────
  server.post('/admin/platform-offers', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { title, subtitle, code_label, color, offer_type, value, min_order, valid_to } =
      request.body as any
    if (!title || !offer_type) {
      return reply.status(400).send({ error: 'title and offer_type are required' })
    }
    const [offer] = await db('platform_offers').insert({
      title,
      subtitle:   subtitle   || null,
      code_label: code_label || null,
      color:      color      || 'orange',
      offer_type,
      value:      parseFloat(value)     || 0,
      min_order:  parseFloat(min_order) || 0,
      valid_to:   valid_to ? new Date(valid_to) : null,
    }).returning('*')
    return reply.status(201).send({ offer })
  })

  // ── PATCH /admin/platform-offers/:id — update ────────────────────────────────
  server.patch('/admin/platform-offers/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    const body = request.body as any
    const allowed = ['title', 'subtitle', 'code_label', 'color', 'offer_type',
                     'value', 'min_order', 'is_active', 'valid_to']
    const patch: any = { updated_at: new Date() }
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (body.valid_to) patch.valid_to = new Date(body.valid_to)
    const [offer] = await db('platform_offers').where({ id }).update(patch).returning('*')
    if (!offer) return reply.status(404).send({ error: 'Offer not found' })
    return reply.send({ offer })
  })

  // ── DELETE /admin/platform-offers/:id ────────────────────────────────────────
  server.delete('/admin/platform-offers/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    await db('platform_offers').where({ id }).delete()
    return reply.send({ ok: true })
  })
}
