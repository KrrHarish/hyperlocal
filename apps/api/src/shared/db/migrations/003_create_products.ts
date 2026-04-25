import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('master_products', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.string('name', 300).notNullable()
    t.string('brand', 100)
    t.string('category', 50).notNullable()
    t.string('subcategory', 50)
    t.string('barcode', 50)
    t.string('unit', 30)
    t.text('image_url')
    t.text('description')
    t.boolean('is_approved').defaultTo(true)
    t.timestamps(true, true)
  })

  await knex.schema.createTable('shop_products', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('shop_id').references('id').inTable('shops').notNullable()
    t.uuid('master_product_id').references('id').inTable('master_products').notNullable()
    t.decimal('price', 10, 2).notNullable()
    t.string('stock_status', 20).defaultTo('in_stock')
    t.integer('quantity').defaultTo(0)
    t.boolean('is_visible').defaultTo(true)
    t.timestamps(true, true)
    t.unique(['shop_id', 'master_product_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shop_products')
  await knex.schema.dropTableIfExists('master_products')
}