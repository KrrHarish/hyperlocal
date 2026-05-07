import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('subscriptions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('customer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.jsonb('delivery_address').notNullable()
    table.string('frequency', 20).notNullable() // 'daily' | 'weekly' | 'biweekly' | 'monthly'
    table.smallint('day_of_week').nullable()     // 0=Sun … 6=Sat
    table.timestamp('next_run_at').notNullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.text('label').nullable()               // e.g. "Morning groceries"
    table.timestamps(true, true)
  })

  await knex.schema.createTable('subscription_items', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('subscription_id').notNullable()
      .references('id').inTable('subscriptions').onDelete('CASCADE')
    table.uuid('shop_product_id').notNullable()
      .references('id').inTable('shop_products').onDelete('CASCADE')
    table.string('product_name', 300).notNullable() // snapshot
    table.integer('quantity').notNullable().defaultTo(1)
    table.decimal('unit_price', 10, 2).notNullable() // snapshot
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscription_items')
  await knex.schema.dropTableIfExists('subscriptions')
}
