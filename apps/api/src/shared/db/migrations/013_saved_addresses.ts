import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('saved_addresses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('customer_id').references('id').inTable('users').notNullable()
    t.string('label', 50).notNullable() // Home | Work | Other
    t.text('full_address').notNullable()
    t.decimal('lat', 10, 7).notNullable()
    t.decimal('lng', 10, 7).notNullable()
    t.boolean('is_default').defaultTo(false)
    t.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('saved_addresses')
}
