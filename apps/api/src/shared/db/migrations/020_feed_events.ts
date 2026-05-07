import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feed_events', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.string('event_type', 40).notNullable()
    // 'new_items_added' | 'item_restocked' | 'shop_opened' | 'deal_posted' | 'new_shop'
    table.string('title', 300).notNullable()
    table.text('body').nullable()
    table.text('image_url').nullable()
    table.decimal('lat', 10, 7).nullable()
    table.decimal('lng', 10, 7).nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('expires_at').notNullable()
  })
  await knex.schema.raw(`CREATE INDEX feed_events_time_idx ON feed_events(created_at DESC)`)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('feed_events')
}
