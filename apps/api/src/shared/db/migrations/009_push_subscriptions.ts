import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('push_subscriptions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    t.text('endpoint').notNullable()
    t.text('p256dh').notNullable()
    t.text('auth').notNullable()
    t.timestamps(true, true)
    t.unique(['shop_id', 'endpoint'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('push_subscriptions')
}
