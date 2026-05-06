import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('order_ratings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE').notNullable()
    t.uuid('customer_id').references('id').inTable('users').notNullable()
    t.uuid('rider_id').references('id').inTable('riders').nullable()
    t.uuid('shop_id').references('id').inTable('shops').notNullable()
    t.integer('rider_rating').nullable() // 1-5
    t.integer('shop_rating').nullable()  // 1-5
    t.text('review').nullable()
    t.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_ratings')
}
