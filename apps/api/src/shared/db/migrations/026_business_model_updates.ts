import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // ── 1. Deactivate free plan — 30-day trial is fine, "free forever" is not ──
  await knex('shop_subscription_plans').where({ key: 'free' }).update({ is_active: false })

  // ── 2. Raise commission to sustainable rates ──
  //    Still way below Swiggy/Zomato (18–30%) so it's a strong selling point
  await knex('shop_subscription_plans').where({ key: 'growth' }).update({
    commission_rate: 10.00,
    description: 'For growing shops. Only 10% commission — Swiggy charges 22%. You keep more.',
  })
  await knex('shop_subscription_plans').where({ key: 'pro' }).update({
    commission_rate: 5.00,
    description: 'For high-volume shops — pharmacies, supermarkets. Industry-low 5% commission.',
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex('shop_subscription_plans').where({ key: 'free' }).update({ is_active: true })
  await knex('shop_subscription_plans').where({ key: 'growth' }).update({
    commission_rate: 5.00,
    description: 'For shops doing ₹50k+/month. Save more as you grow.',
  })
  await knex('shop_subscription_plans').where({ key: 'pro' }).update({
    commission_rate: 2.00,
    description: 'For high-volume shops — pharmacies, supermarkets.',
  })
}
