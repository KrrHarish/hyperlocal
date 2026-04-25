import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('riders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.string('phone', 15).unique().notNullable()
    t.string('name', 100).notNullable()
    t.string('vehicle_type', 20).defaultTo('bike') // bike | scooter | bicycle
    t.decimal('lat', 10, 7).nullable()
    t.decimal('lng', 10, 7).nullable()
    t.timestamp('location_updated').nullable()
    t.boolean('is_online').defaultTo(false)
    t.boolean('is_verified').defaultTo(false)
    t.boolean('is_suspended').defaultTo(false)
    t.decimal('trust_score', 5, 2).defaultTo(70.00)
    t.decimal('wallet_balance', 10, 2).defaultTo(0)
    t.string('fcm_token').nullable()
    t.string('device_id').nullable()
    t.integer('rejection_count').defaultTo(0)
    t.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('riders')
}