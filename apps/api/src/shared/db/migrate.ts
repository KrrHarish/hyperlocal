import dotenv from 'dotenv'
dotenv.config()

import knex from 'knex'

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './src/shared/db/migrations',
    extension: 'ts',
  },
})

db.migrate.latest()
  .then(() => {
    console.log('Migrations done')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })