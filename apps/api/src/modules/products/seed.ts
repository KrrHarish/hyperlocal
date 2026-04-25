import dotenv from 'dotenv'
dotenv.config()

import knex from 'knex'

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
})

const products = [
  { name: 'Tata Salt', brand: 'Tata', category: 'grocery', subcategory: 'staples', unit: '1kg' },
  { name: 'Aashirvaad Atta', brand: 'Aashirvaad', category: 'grocery', subcategory: 'staples', unit: '5kg' },
  { name: 'Fortune Sunflower Oil', brand: 'Fortune', category: 'grocery', subcategory: 'oils', unit: '1L' },
  { name: 'Tata Tea Gold', brand: 'Tata', category: 'grocery', subcategory: 'beverages', unit: '250g' },
  { name: 'Nescafe Classic', brand: 'Nestle', category: 'grocery', subcategory: 'beverages', unit: '50g' },
  { name: 'Parle-G Biscuits', brand: 'Parle', category: 'grocery', subcategory: 'snacks', unit: '200g' },
  { name: 'Britannia Good Day', brand: 'Britannia', category: 'grocery', subcategory: 'snacks', unit: '150g' },
  { name: 'Maggi Noodles', brand: 'Nestle', category: 'grocery', subcategory: 'instant food', unit: 'Pack of 4' },
  { name: 'Amul Butter', brand: 'Amul', category: 'dairy', subcategory: 'butter', unit: '500g' },
  { name: 'Amul Milk', brand: 'Amul', category: 'dairy', subcategory: 'milk', unit: '1L' },
  { name: 'Mother Dairy Curd', brand: 'Mother Dairy', category: 'dairy', subcategory: 'curd', unit: '400g' },
  { name: 'Amul Cheese Slices', brand: 'Amul', category: 'dairy', subcategory: 'cheese', unit: '200g' },
  { name: 'Surf Excel', brand: 'HUL', category: 'household', subcategory: 'detergent', unit: '1kg' },
  { name: 'Ariel Matic', brand: 'P&G', category: 'household', subcategory: 'detergent', unit: '1kg' },
  { name: 'Vim Dishwash Bar', brand: 'HUL', category: 'household', subcategory: 'cleaning', unit: '300g' },
  { name: 'Colgate Strong Teeth', brand: 'Colgate', category: 'personal care', subcategory: 'toothpaste', unit: '200g' },
  { name: 'Dove Soap', brand: 'HUL', category: 'personal care', subcategory: 'soap', unit: '100g' },
  { name: 'Pantene Shampoo', brand: 'P&G', category: 'personal care', subcategory: 'shampoo', unit: '180ml' },
  { name: 'Dettol Handwash', brand: 'Reckitt', category: 'personal care', subcategory: 'handwash', unit: '200ml' },
  { name: 'India Gate Basmati Rice', brand: 'India Gate', category: 'grocery', subcategory: 'staples', unit: '5kg' },
]

async function seed() {
  console.log('Seeding master catalog...')

  for (const product of products) {
    const existing = await db('master_products')
      .where({ name: product.name, brand: product.brand })
      .first()

    if (!existing) {
      await db('master_products').insert(product)
      console.log(`Added: ${product.name}`)
    } else {
      console.log(`Skipped (exists): ${product.name}`)
    }
  }

  console.log('Seed complete.')
  await db.destroy()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})