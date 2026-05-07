import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('app_categories', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('key', 50).notNullable().unique()          // 'grocery', 'food', 'medicine', etc.
    table.string('name', 100).notNullable()
    table.string('emoji', 10).notNullable()
    table.text('description').nullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.boolean('under_construction').notNullable().defaultTo(false)
    table.integer('sort_order').notNullable().defaultTo(0)
    // geo_restrictions: [{lat, lng, radius_km, label}] — null = available everywhere
    table.jsonb('geo_restrictions').nullable()
    table.timestamps(true, true)
  })

  // Seed default categories
  await knex('app_categories').insert([
    {
      key: 'grocery',
      name: 'Grocery & Essentials',
      emoji: '🛒',
      description: 'Groceries, bakery, dairy, personal care & home essentials',
      is_active: true,
      under_construction: false,
      sort_order: 1,
    },
    {
      key: 'food',
      name: 'Food & Restaurants',
      emoji: '🍕',
      description: 'Order from restaurants, home kitchens & tiffin services',
      is_active: true,
      under_construction: false,
      sort_order: 2,
    },
    {
      key: 'medicine',
      name: 'Medicines & Health',
      emoji: '💊',
      description: 'Medicines, wellness products & health essentials',
      is_active: true,
      under_construction: false,
      sort_order: 3,
    },
    {
      key: 'bike_taxi',
      name: 'Bike Taxi',
      emoji: '🛵',
      description: 'Quick & affordable rides around your city',
      is_active: true,
      under_construction: true,
      sort_order: 4,
    },
  ])
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('app_categories')
}
