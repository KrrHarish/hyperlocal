import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    table.text('image_url').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    table.dropColumn('image_url')
  })
}
