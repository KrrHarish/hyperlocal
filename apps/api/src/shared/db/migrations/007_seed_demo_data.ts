import { Knex } from 'knex'

// Seed master products and link them to every existing shop.
// Safe to re-run — uses ON CONFLICT DO NOTHING throughout.

const MASTER_PRODUCTS = [
  { name: 'Tata Salt',              brand: 'Tata',      category: 'grocery',       unit: '1 kg',    price: 22  },
  { name: 'Fortune Sunflower Oil',  brand: 'Fortune',   category: 'grocery',       unit: '1 L',     price: 145 },
  { name: 'Aashirvaad Atta',        brand: 'Aashirvaad',category: 'grocery',       unit: '5 kg',    price: 280 },
  { name: 'Toor Dal',               brand: 'Generic',   category: 'grocery',       unit: '1 kg',    price: 140 },
  { name: 'Basmati Rice',           brand: 'India Gate', category: 'grocery',      unit: '5 kg',    price: 350 },
  { name: 'Sugar',                  brand: 'Generic',   category: 'grocery',       unit: '1 kg',    price: 45  },
  { name: 'Amul Milk',              brand: 'Amul',      category: 'dairy',         unit: '500 ml',  price: 28  },
  { name: 'Amul Butter',            brand: 'Amul',      category: 'dairy',         unit: '100 g',   price: 56  },
  { name: 'Mother Dairy Curd',      brand: 'Mother Dairy', category: 'dairy',      unit: '400 g',   price: 38  },
  { name: 'Amul Cheese Slices',     brand: 'Amul',      category: 'dairy',         unit: '10 slices', price: 125 },
  { name: 'Lays Classic',           brand: 'Lays',      category: 'snacks',        unit: '90 g',    price: 20  },
  { name: 'Maggi Noodles',          brand: 'Maggi',     category: 'snacks',        unit: '4 pack',  price: 60  },
  { name: 'Parle-G Biscuits',       brand: 'Parle',     category: 'snacks',        unit: '500 g',   price: 35  },
  { name: 'Kurkure Masala',         brand: 'Kurkure',   category: 'snacks',        unit: '90 g',    price: 20  },
  { name: 'Tropicana Orange Juice', brand: 'Tropicana', category: 'beverages',     unit: '1 L',     price: 85  },
  { name: 'Coca Cola',              brand: 'Coca Cola', category: 'beverages',     unit: '750 ml',  price: 42  },
  { name: 'Red Bull',               brand: 'Red Bull',  category: 'beverages',     unit: '250 ml',  price: 125 },
  { name: 'Minute Maid Pulpy',      brand: 'Minute Maid', category: 'beverages',   unit: '250 ml',  price: 30  },
  { name: 'Colgate MaxFresh',       brand: 'Colgate',   category: 'personal_care', unit: '150 g',   price: 65  },
  { name: 'Dove Shampoo',           brand: 'Dove',      category: 'personal_care', unit: '180 ml',  price: 175 },
  { name: 'Dettol Soap',            brand: 'Dettol',    category: 'personal_care', unit: '75 g',    price: 35  },
  { name: 'Surf Excel Detergent',   brand: 'Surf Excel', category: 'household',    unit: '500 g',   price: 78  },
  { name: 'Harpic Toilet Cleaner',  brand: 'Harpic',    category: 'household',     unit: '500 ml',  price: 95  },
  { name: 'Britannia Bread',        brand: 'Britannia', category: 'bakery',        unit: '400 g',   price: 42  },
  { name: 'Dolo 650',               brand: 'Micro Labs', category: 'pharmacy',     unit: '1 strip', price: 30  },
]

export async function up(knex: Knex): Promise<void> {
  // 1. Insert master products (skip if name already exists)
  for (const p of MASTER_PRODUCTS) {
    const exists = await knex('master_products').where('name', p.name).first()
    if (!exists) {
      await knex('master_products').insert({
        name: p.name, brand: p.brand, category: p.category,
        unit: p.unit, is_approved: true,
      })
    }
  }

  // 2. Mark all shops as active and open (prototype — skip manual activation step)
  await knex('shops').update({ is_active: true, is_open: true })

  // 4. Fetch all master products and all shops
  const masterProducts = await knex('master_products').select('id', 'name')
  const shops          = await knex('shops').select('id')

  // Build a price map from name → price
  const priceMap: Record<string, number> = {}
  for (const p of MASTER_PRODUCTS) priceMap[p.name] = p.price

  // 5. Link every master product to every shop (skip if already linked)
  for (const shop of shops) {
    for (const mp of masterProducts) {
      const price = priceMap[mp.name] || 50
      await knex.raw(`
        INSERT INTO shop_products (id, shop_id, master_product_id, price, stock_status, is_visible)
        VALUES (uuid_generate_v4(), ?, ?, ?, 'in_stock', true)
        ON CONFLICT (shop_id, master_product_id) DO NOTHING
      `, [shop.id, mp.id, price])
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove all seeded shop_products and master_products
  await knex('shop_products').delete()
  await knex('master_products').whereIn('name', MASTER_PRODUCTS.map(p => p.name)).delete()
}
