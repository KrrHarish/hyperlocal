import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Table 1: plan definitions (managed by admin)
  await knex.schema.createTable('shop_subscription_plans', table => {
    table.string('key', 50).primary()                    // 'free' | 'growth' | 'pro'
    table.string('name', 100).notNullable()
    table.integer('monthly_fee').notNullable().defaultTo(0)   // in INR
    table.decimal('commission_rate', 5, 2).notNullable()      // e.g. 10.00, 5.00, 2.00
    table.boolean('is_active').notNullable().defaultTo(true)
    table.text('description').nullable()
    table.jsonb('features').nullable()           // array of feature strings
    // category_overrides: { grocery: { monthly_fee: 1499 }, medicine: { monthly_fee: 2999 } }
    table.jsonb('category_overrides').nullable()
    table.integer('sort_order').notNullable().defaultTo(0)
    table.timestamps(true, true)
  })

  // Table 2: per-shop active subscription
  await knex.schema.createTable('shop_subscriptions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE')
    table.string('plan_key', 50).notNullable().defaultTo('free')
    table.string('status', 20).notNullable().defaultTo('active')  // active | expired | cancelled
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('expires_at').nullable()
    table.boolean('admin_override').notNullable().defaultTo(false)
    table.string('override_note', 255).nullable()
    table.timestamps(true, true)
    table.unique(['shop_id'])
  })

  // Seed the 3 default plans
  await knex('shop_subscription_plans').insert([
    {
      key: 'free',
      name: 'Free',
      monthly_fee: 0,
      commission_rate: 10.00,
      is_active: true,
      description: 'Get started with zero cost. Platform takes 10% per order.',
      features: JSON.stringify(['Up to 50 products', 'Basic analytics', 'Order management', 'Email support']),
      category_overrides: JSON.stringify({}),
      sort_order: 1,
    },
    {
      key: 'growth',
      name: 'Growth',
      monthly_fee: 999,
      commission_rate: 5.00,
      is_active: true,
      description: 'For shops doing ₹50,000+ per month. Save more as you grow.',
      features: JSON.stringify(['Unlimited products', 'Advanced analytics', 'Priority listing', 'Deal promotions', 'Chat with customers', 'Phone support']),
      category_overrides: JSON.stringify({}),
      sort_order: 2,
    },
    {
      key: 'pro',
      name: 'Pro',
      monthly_fee: 2499,
      commission_rate: 2.00,
      is_active: true,
      description: 'For high-volume shops — pharmacies, supermarkets, electronics.',
      features: JSON.stringify(['Everything in Growth', 'Only 2% commission', 'Featured placement', 'Dedicated account manager', 'Custom branding', 'API access']),
      category_overrides: JSON.stringify({}),
      sort_order: 3,
    },
  ])
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shop_subscriptions')
  await knex.schema.dropTableIfExists('shop_subscription_plans')
}
