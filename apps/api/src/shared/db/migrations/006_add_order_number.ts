import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Add a non-PK auto-incrementing order_number so the UI can show
  // #ORD-0001 instead of a raw UUID.
  await knex.raw(`
    CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 1;
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_number INTEGER
        NOT NULL DEFAULT nextval('orders_order_number_seq');
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE orders DROP COLUMN IF EXISTS order_number;
    DROP SEQUENCE IF EXISTS orders_order_number_seq;
  `)
}
