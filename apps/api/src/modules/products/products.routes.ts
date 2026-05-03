import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { broadcast } from '../../shared/realtime'
import {
  searchMasterCatalog,
  addProductToShop,
  addCustomProductToShop,
  getShopProducts,
  getProductsByCategory,
  updateStockStatus,
  updateShopProduct,
  removeShopProduct,
} from './products.service'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

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

  // POST /shops/:shopId/products/custom  — add a brand-new custom product
  server.post('/shops/:shopId/products/custom', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId } = request.params as { shopId: string }
    const body = request.body as { name: string; brand?: string; category: string; unit?: string; price: number }
    if (!body.name?.trim() || !body.category || !body.price) {
      return reply.status(400).send({ error: 'name, category, and price are required' })
    }
    try {
      const product = await addCustomProductToShop(shopId, body)
      return reply.status(201).send({ message: 'Custom product added', product })
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
    broadcast({ type: 'product_updated', shopId, productId, stock_status: status })
    return reply.send({ message: 'Stock updated', product: updated })
  })

  // PATCH /shops/:shopId/products/:productId  — update price, name, brand, unit
  server.patch('/shops/:shopId/products/:productId', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId, productId } = request.params as { shopId: string; productId: string }
    const { price, name, brand, unit } = request.body as { price?: number; name?: string; brand?: string; unit?: string }
    if (price !== undefined && (isNaN(price) || price <= 0)) {
      return reply.status(400).send({ error: 'Invalid price' })
    }
    if (name !== undefined && !name.trim()) {
      return reply.status(400).send({ error: 'Product name cannot be empty' })
    }
    const updated = await updateShopProduct(productId, shopId, { price, name: name?.trim(), brand: brand?.trim(), unit: unit?.trim() })
    broadcast({ type: 'product_updated', shopId, productId, price, name, brand, unit })
    return reply.send({ message: 'Product updated', product: updated })
  })

  // POST /shops/:shopId/products/:productId/image  — upload image
  server.post('/shops/:shopId/products/:productId/image', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId, productId } = request.params as { shopId: string; productId: string }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename) || '.jpg'
    const filename = `${productId}${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    await pipeline(data.file, fs.createWriteStream(filepath))

    const imageUrl = `/uploads/${filename}`
    const updated = await updateShopProduct(productId, shopId, { custom_image_url: imageUrl })
    broadcast({ type: 'product_updated', shopId, productId, custom_image_url: imageUrl })
    return reply.send({ message: 'Image uploaded', image_url: imageUrl, product: updated })
  })

  // DELETE /shops/:shopId/products/:productId  — hide product from catalogue
  server.delete('/shops/:shopId/products/:productId', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.status(401).send({ error: 'Unauthorized' }) }
    const { shopId, productId } = request.params as { shopId: string; productId: string }
    await removeShopProduct(productId, shopId)
    return reply.send({ message: 'Product removed' })
  })
}