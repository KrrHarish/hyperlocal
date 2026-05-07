import { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('platform_offers', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.string('title').notNullable()
    t.string('subtitle')
    t.string('code_label')                   // e.g. "FIRST20" — shown as a coupon chip
    t.string('color').defaultTo('orange')    // 'orange' | 'green' | 'purple' | 'blue'
    t.string('offer_type').notNullable()     // 'percent_off' | 'flat_off' | 'free_delivery'
    t.decimal('value', 10, 2).defaultTo(0)  // discount amount
    t.decimal('min_order', 10, 2).defaultTo(0)
    t.boolean('is_active').defaultTo(true)
    t.timestamp('valid_from').defaultTo(knex.fn.now())
    t.timestamp('valid_to')
    t.timestamps(true, true)
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('platform_offers')
}
