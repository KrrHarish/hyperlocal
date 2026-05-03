import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shop_products', (t) => {
    t.text('custom_image_url').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shop_products', (t) => {
    t.dropColumn('custom_image_url')
  })
}
