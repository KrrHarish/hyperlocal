import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('customer_id').references('id').inTable('users').notNullable()
    t.uuid('shop_id').references('id').inTable('shops').notNullable()
    t.uuid('rider_id').references('id').inTable('users').nullable()
    t.string('status', 30).defaultTo('pending')
    // pending → confirmed → assigned → picked_up → delivered → cancelled
    t.decimal('subtotal', 10, 2).notNullable()
    t.decimal('delivery_fee', 10, 2).defaultTo(25)
    t.decimal('total_amount', 10, 2).notNullable()
    t.decimal('commission_amount', 10, 2).defaultTo(0)
    t.string('payment_status', 20).defaultTo('pending')
    t.string('payment_method', 30).defaultTo('prepaid')
    t.jsonb('delivery_address').notNullable()
    t.string('delivery_otp', 6)
    t.boolean('otp_verified').defaultTo(false)
    t.text('cancellation_reason')
    t.timestamp('confirmed_at').nullable()
    t.timestamp('assigned_at').nullable()
    t.timestamp('picked_up_at').nullable()
    t.timestamp('delivered_at').nullable()
    t.timestamp('cancelled_at').nullable()
    t.timestamps(true, true)
  })

  await knex.schema.createTable('order_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE')
    t.uuid('shop_product_id').references('id').inTable('shop_products')
    t.string('product_name', 300).notNullable()
    t.string('product_brand', 100)
    t.string('product_unit', 30)
    t.integer('quantity').notNullable()
    t.decimal('unit_price', 10, 2).notNullable()
    t.decimal('subtotal', 10, 2).notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_items')
  await knex.schema.dropTableIfExists('orders')
}