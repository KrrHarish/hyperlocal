import { Knex } from 'knex'

// Co-funded platform offers: shop and platform each contribute a portion of the discount.
// This prevents Zuqu from absorbing 100% of offer costs at scale.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('platform_offers', table => {
    table.decimal('shop_contribution', 10, 2).defaultTo(0).notNullable()      // shop pays this much per order
    table.decimal('platform_contribution', 10, 2).defaultTo(0).notNullable() // platform pays this much per order
  })
  // Migrate existing offers: platform was absorbing 100%
  await knex.raw(`
    UPDATE platform_offers
    SET platform_contribution = value, shop_contribution = 0
    WHERE platform_contribution = 0
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('platform_offers', table => {
    table.dropColumn('shop_contribution')
    table.dropColumn('platform_contribution')
  })
}
