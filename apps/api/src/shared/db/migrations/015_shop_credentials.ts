import { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('shop_credentials', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.string('username', 100).notNullable().unique()
    table.text('password_hash').notNullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('shop_credentials')
}
