import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rider_id_foreign')
  await knex.raw('ALTER TABLE orders ADD CONSTRAINT orders_rider_id_fk FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rider_id_fk')
  await knex.raw('ALTER TABLE orders ADD CONSTRAINT orders_rider_id_foreign FOREIGN KEY (rider_id) REFERENCES users(id)')
}
