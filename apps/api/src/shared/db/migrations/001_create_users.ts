import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis')

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.string('phone', 15).unique().notNullable()
    t.string('name', 100)
    t.string('email', 200)
    t.decimal('wallet_balance', 10, 2).defaultTo(0)
    t.string('subscription', 20).defaultTo('free')
    t.string('fcm_token')
    t.boolean('is_active').defaultTo(true)
    t.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users')
}