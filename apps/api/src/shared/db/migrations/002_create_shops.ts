import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shops', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('owner_id').references('id').inTable('users').notNullable()
    t.string('name', 200).notNullable()
    t.string('category', 50).notNullable()
    t.text('address').notNullable()
    t.decimal('lat', 10, 7).notNullable()
    t.decimal('lng', 10, 7).notNullable()
    t.string('phone', 15)
    t.string('subscription', 20).defaultTo('free')
    t.decimal('commission_rate', 4, 2).defaultTo(10.00)
    t.boolean('is_active').defaultTo(false)
    t.boolean('is_open').defaultTo(false)
    t.decimal('rating', 3, 2).defaultTo(0)
    t.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shops')
}