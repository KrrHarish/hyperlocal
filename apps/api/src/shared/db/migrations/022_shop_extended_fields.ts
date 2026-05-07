import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    // Home producers
    table.string('shop_type', 30).notNullable().defaultTo('standard')
    // 'standard' | 'home_producer'
    table.string('producer_badge', 50).nullable()
    // 'home_baker' | 'tiffin_service' | 'pickle_maker' | 'artisan' | 'home_chef'

    // Late-night / emergency
    table.boolean('is_24h').notNullable().defaultTo(false)
    table.boolean('late_night_tag').notNullable().defaultTo(false)
    table.jsonb('operating_hours').nullable()
    // { mon:{open:'07:00',close:'23:00'}, tue:{...}, ..., always_open:false }
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shops', table => {
    table.dropColumn('shop_type')
    table.dropColumn('producer_badge')
    table.dropColumn('is_24h')
    table.dropColumn('late_night_tag')
    table.dropColumn('operating_hours')
  })
}
