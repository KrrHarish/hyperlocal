import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shop_deals', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.string('title', 200).notNullable()
    table.string('deal_type', 10).notNullable() // 'percent' | 'flat'
    table.decimal('deal_value', 10, 2).notNullable()
    table.decimal('min_order', 10, 2).notNullable().defaultTo(0)
    table.decimal('max_discount', 10, 2).nullable()
    table.timestamp('valid_from').notNullable().defaultTo(knex.fn.now())
    table.timestamp('valid_to').notNullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.integer('uses_count').notNullable().defaultTo(0)
    table.integer('max_uses').notNullable().defaultTo(1000)
    table.timestamps(true, true)
  })

  // Add deal tracking columns to orders
  await knex.schema.alterTable('orders', table => {
    table.uuid('deal_id').nullable().references('id').inTable('shop_deals').onDelete('SET NULL')
    table.string('discount_source', 20).nullable() // 'promo_code' | 'deal' | null
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', table => {
    table.dropColumn('deal_id')
    table.dropColumn('discount_source')
  })
  await knex.schema.dropTableIfExists('shop_deals')
}
