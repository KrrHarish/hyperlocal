import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chat_messages', table => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.uuid('customer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('sender_role', 10).notNullable() // 'customer' | 'shop'
    table.text('body').notNullable()
    table.boolean('is_read').notNullable().defaultTo(false)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.raw(`
    CREATE INDEX chat_messages_thread_idx ON chat_messages(shop_id, customer_id, created_at DESC)
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_messages')
}
