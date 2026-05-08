import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    table.boolean('is_featured').defaultTo(false).notNullable()
    table.timestamp('featured_until').nullable()              // null = featured forever
    table.string('featured_badge', 50).nullable()             // e.g. "Popular", "Top Rated"
    table.integer('featured_sort_order').defaultTo(0)         // higher = shown first
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    table.dropColumn('is_featured')
    table.dropColumn('featured_until')
    table.dropColumn('featured_badge')
    table.dropColumn('featured_sort_order')
  })
}
