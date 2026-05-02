import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('customer_push_tokens', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('customer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.text('token').notNullable()
    t.text('platform').defaultTo('unknown')  // 'ios' | 'android'
    t.timestamps(true, true)
    t.unique(['customer_id', 'token'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('customer_push_tokens')
}
