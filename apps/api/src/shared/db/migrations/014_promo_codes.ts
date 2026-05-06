import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('promo_codes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.string('code', 20).unique().notNullable()
    t.string('type', 10).notNullable() // percent | flat
    t.decimal('value', 10, 2).notNullable()
    t.decimal('min_order', 10, 2).defaultTo(0)
    t.decimal('max_discount', 10, 2).nullable() // cap for percent type
    t.integer('max_uses').defaultTo(100)
    t.integer('uses_count').defaultTo(0)
    t.timestamp('valid_from').notNullable()
    t.timestamp('valid_to').nullable()
    t.boolean('is_active').defaultTo(true)
    t.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('promo_codes')
}
