import { FastifyInstance } from 'fastify'
import {
  searchMasterCatalog,
  addProductToShop,
  getShopProducts,
  getProductsByCategory,
  updateStockStatus
} from './products.service'

export async function productRoutes(server: FastifyInstance) {

  // GET /products/by-category?category=grocery
  server.get('/products/by-category', async (request, reply) => {
    const { category } = request.query as { category?: string }
    if (!category) return reply.status(400).send({ error: 'category is required' })
    try {
      const products = await getProductsByCategory(category)
      return reply.send({ products })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /products/search?q=tata
  server.get('/products/search', async (request, reply) => {
    const { q } = request.query as { q: string }
    if (!q) return reply.status(400).send({ error: 'q is required' })

    const products = await searchMasterCatalog(q)
    return reply.send({ products })
  })

  // GET /shops/:shopId/products
  server.get('/shops/:shopId/products', async (request, reply) => {
    const { shopId } = request.params as { shopId: string }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(shopId)) {
      return reply.send({ products: [] })  // fake/partial ID — return empty gracefully
    }
    try {
      const products = await getShopProducts(shopId)
      return reply.send({ products })
    } catch (err: any) {
      return reply.send({ products: [] })
    }
  })

  // POST /shops/:shopId/products
  server.post('/shops/:shopId/products', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { shopId } = request.params as { shopId: string }
    const body = request.body as {
      master_product_id: string
      price: number
      quantity?: number
    }

    if (!body.master_product_id || !body.price) {
      return reply.status(400).send({ error: 'master_product_id and price are required' })
    }

    try {
      const product = await addProductToShop(shopId, body)
      return reply.status(201).send({ message: 'Product added to shop', product })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // PATCH /shops/:shopId/products/:productId/stock
  server.patch('/shops/:shopId/products/:productId/stock', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { shopId, productId } = request.params as { shopId: string; productId: string }
    const { status } = request.body as { status: string }

    if (!['in_stock', 'out_of_stock', 'low'].includes(status)) {
      return reply.status(400).send({ error: 'status must be in_stock, out_of_stock, or low' })
    }

    const updated = await updateStockStatus(productId, shopId, status)
    return reply.send({ message: 'Stock updated', product: updated })
  })
}