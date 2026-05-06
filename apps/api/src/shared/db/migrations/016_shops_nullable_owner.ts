import { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('shops', table => {
    table.uuid('owner_id').nullable().alter()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('shops', table => {
    table.uuid('owner_id').notNullable().alter()
  })
}
