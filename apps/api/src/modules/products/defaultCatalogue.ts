import { db } from '../../shared/db/knex'

// ─── Default product definitions per shop category ────────────────────────────
// Each product becomes a master_product entry (if it doesn't exist yet)
// and is linked to the new shop via shop_products.

interface DefaultProduct {
  name: string
  brand: string
  category: string   // master_products.category (internal grouping)
  unit: string
  price: number
  description?: string
}

const CATALOGUE: Record<string, DefaultProduct[]> = {

  restaurant: [
    { name: 'Veg Thali',              brand: 'Chef Special',  category: 'restaurant', unit: '1 plate',  price: 120 },
    { name: 'Chicken Biryani',        brand: 'Chef Special',  category: 'restaurant', unit: '1 plate',  price: 180 },
    { name: 'Masala Dosa',            brand: 'Chef Special',  category: 'restaurant', unit: '1 piece',  price: 70  },
    { name: 'Idli Sambar',            brand: 'Chef Special',  category: 'restaurant', unit: '2 pieces', price: 50  },
    { name: 'Paneer Butter Masala',   brand: 'Chef Special',  category: 'restaurant', unit: '1 bowl',   price: 160 },
    { name: 'Dal Makhani',            brand: 'Chef Special',  category: 'restaurant', unit: '1 bowl',   price: 130 },
    { name: 'Butter Naan',            brand: 'Chef Special',  category: 'restaurant', unit: '2 pieces', price: 60  },
    { name: 'Fried Rice',             brand: 'Chef Special',  category: 'restaurant', unit: '1 plate',  price: 110 },
    { name: 'Gobi Manchurian',        brand: 'Chef Special',  category: 'restaurant', unit: '1 plate',  price: 130 },
    { name: 'Mango Lassi',            brand: 'Chef Special',  category: 'restaurant', unit: '300 ml',   price: 60  },
    { name: 'Masala Chai',            brand: 'Chef Special',  category: 'restaurant', unit: '1 cup',    price: 20  },
    { name: 'Mineral Water',          brand: 'Bisleri',       category: 'beverages',  unit: '500 ml',   price: 20  },
    { name: 'Cold Drink',             brand: 'Coca Cola',     category: 'beverages',  unit: '300 ml',   price: 35  },
    { name: 'Gulab Jamun',            brand: 'Chef Special',  category: 'restaurant', unit: '2 pieces', price: 40  },
    { name: 'Ice Cream',              brand: 'Chef Special',  category: 'restaurant', unit: '1 scoop',  price: 50  },
  ],

  grocery: [
    { name: 'Tata Salt',              brand: 'Tata',          category: 'grocery',      unit: '1 kg',    price: 22  },
    { name: 'Aashirvaad Atta',        brand: 'Aashirvaad',    category: 'grocery',      unit: '5 kg',    price: 280 },
    { name: 'Fortune Sunflower Oil',  brand: 'Fortune',       category: 'grocery',      unit: '1 L',     price: 145 },
    { name: 'Toor Dal',               brand: 'Generic',       category: 'grocery',      unit: '1 kg',    price: 140 },
    { name: 'Basmati Rice',           brand: 'India Gate',    category: 'grocery',      unit: '5 kg',    price: 350 },
    { name: 'Sugar',                  brand: 'Generic',       category: 'grocery',      unit: '1 kg',    price: 45  },
    { name: 'Red Chilli Powder',      brand: 'Everest',       category: 'grocery',      unit: '100 g',   price: 45  },
    { name: 'Turmeric Powder',        brand: 'Everest',       category: 'grocery',      unit: '100 g',   price: 35  },
    { name: 'Coriander Powder',       brand: 'Everest',       category: 'grocery',      unit: '100 g',   price: 38  },
    { name: 'Mustard Seeds',          brand: 'Generic',       category: 'grocery',      unit: '100 g',   price: 25  },
    { name: 'Cumin Seeds',            brand: 'Generic',       category: 'grocery',      unit: '100 g',   price: 35  },
    { name: 'Tata Tea Gold',          brand: 'Tata',          category: 'beverages',    unit: '250 g',   price: 135 },
    { name: 'Nescafé Classic',        brand: 'Nescafé',       category: 'beverages',    unit: '50 g',    price: 120 },
    { name: 'Maggi Noodles',          brand: 'Maggi',         category: 'snacks',       unit: '4 pack',  price: 60  },
    { name: 'Parle-G Biscuits',       brand: 'Parle',         category: 'snacks',       unit: '500 g',   price: 35  },
  ],

  pharmacy: [
    { name: 'Dolo 650',               brand: 'Micro Labs',    category: 'pharmacy',     unit: '1 strip', price: 30  },
    { name: 'Crocin Pain Relief',     brand: 'GSK',           category: 'pharmacy',     unit: '1 strip', price: 28  },
    { name: 'Vicks VapoRub',          brand: 'Vicks',         category: 'pharmacy',     unit: '50 ml',   price: 85  },
    { name: 'ORS Sachet',             brand: 'Electral',      category: 'pharmacy',     unit: '5 sachets', price: 40 },
    { name: 'Band-Aid Strips',        brand: 'Band-Aid',      category: 'pharmacy',     unit: '10 strips', price: 55 },
    { name: 'Cough Syrup',            brand: 'Benadryl',      category: 'pharmacy',     unit: '100 ml',  price: 90  },
    { name: 'Digene Antacid',         brand: 'Abbott',        category: 'pharmacy',     unit: '1 strip', price: 45  },
    { name: 'Vitamin C Tablet',       brand: 'Limcee',        category: 'pharmacy',     unit: '1 strip', price: 30  },
    { name: 'Hand Sanitizer',         brand: 'Dettol',        category: 'pharmacy',     unit: '200 ml',  price: 99  },
    { name: 'Face Mask N95',          brand: 'Generic',       category: 'pharmacy',     unit: '5 pieces', price: 80 },
    { name: 'Betadine Solution',      brand: 'Betadine',      category: 'pharmacy',     unit: '100 ml',  price: 85  },
    { name: 'Antiseptic Cream',       brand: 'Boroline',      category: 'pharmacy',     unit: '40 g',    price: 55  },
    { name: 'Eye Drops',              brand: 'Systane',       category: 'pharmacy',     unit: '10 ml',   price: 130 },
    { name: 'Cotton Balls',           brand: 'Generic',       category: 'pharmacy',     unit: '100 pcs', price: 45  },
    { name: 'Digital Thermometer',    brand: 'Dr. Trust',     category: 'pharmacy',     unit: '1 piece', price: 250 },
  ],

  electronics: [
    { name: 'USB-C Charging Cable',   brand: 'Portronics',    category: 'electronics',  unit: '1 m',     price: 299 },
    { name: 'Mobile Charger 20W',     brand: 'Portronics',    category: 'electronics',  unit: '1 piece', price: 499 },
    { name: 'Wired Earphones',        brand: 'boAt',          category: 'electronics',  unit: '1 piece', price: 399 },
    { name: 'Power Bank 10000mAh',    brand: 'Mi',            category: 'electronics',  unit: '1 piece', price: 999 },
    { name: 'Extension Board 4-port', brand: 'Anchor',        category: 'electronics',  unit: '1 piece', price: 450 },
    { name: 'LED Bulb 9W',            brand: 'Syska',         category: 'electronics',  unit: '1 piece', price: 120 },
    { name: 'Screen Protector',       brand: 'Generic',       category: 'electronics',  unit: '1 piece', price: 99  },
    { name: 'Phone Case (Universal)', brand: 'Generic',       category: 'electronics',  unit: '1 piece', price: 149 },
    { name: 'AA Batteries (4 pack)',  brand: 'Duracell',      category: 'electronics',  unit: '4 pieces', price: 180 },
    { name: 'HDMI Cable 1.5m',        brand: 'AmazonBasics',  category: 'electronics',  unit: '1.5 m',   price: 350 },
    { name: 'Wireless Mouse',         brand: 'Logitech',      category: 'electronics',  unit: '1 piece', price: 799 },
    { name: 'USB Hub 4-port',         brand: 'Portronics',    category: 'electronics',  unit: '1 piece', price: 549 },
    { name: 'Bluetooth Speaker Mini', brand: 'boAt',          category: 'electronics',  unit: '1 piece', price: 1299 },
    { name: 'LED Torch',              brand: 'Wipro',         category: 'electronics',  unit: '1 piece', price: 199 },
    { name: 'Micro USB Cable',        brand: 'Portronics',    category: 'electronics',  unit: '1 m',     price: 199 },
  ],

  bakery: [
    { name: 'Britannia White Bread',  brand: 'Britannia',     category: 'bakery',       unit: '400 g',   price: 42  },
    { name: 'Whole Wheat Bread',      brand: 'Britannia',     category: 'bakery',       unit: '400 g',   price: 50  },
    { name: 'Butter Bun',             brand: 'Baker\'s',      category: 'bakery',       unit: '4 pieces', price: 35 },
    { name: 'Croissant',              brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 45  },
    { name: 'Chocolate Cake Slice',   brand: 'Baker\'s',      category: 'bakery',       unit: '1 slice', price: 80  },
    { name: 'Black Forest Pastry',    brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 75  },
    { name: 'Blueberry Muffin',       brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 60  },
    { name: 'Choco Chip Cookies',     brand: 'Baker\'s',      category: 'bakery',       unit: '200 g',   price: 80  },
    { name: 'Rusk',                   brand: 'Britannia',     category: 'bakery',       unit: '300 g',   price: 40  },
    { name: 'Veg Puff',               brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 25  },
    { name: 'Egg Puff',               brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 30  },
    { name: 'Sandwich Loaf',          brand: 'Harvest Gold',  category: 'bakery',       unit: '450 g',   price: 55  },
    { name: 'Pineapple Pastry',       brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 70  },
    { name: 'Doughnut',               brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 40  },
    { name: 'Cinnamon Roll',          brand: 'Baker\'s',      category: 'bakery',       unit: '1 piece', price: 55  },
  ],

  dairy: [
    { name: 'Amul Full Cream Milk',   brand: 'Amul',          category: 'dairy',        unit: '500 ml',  price: 30  },
    { name: 'Amul Toned Milk',        brand: 'Amul',          category: 'dairy',        unit: '500 ml',  price: 28  },
    { name: 'Amul Butter',            brand: 'Amul',          category: 'dairy',        unit: '100 g',   price: 56  },
    { name: 'Amul Paneer',            brand: 'Amul',          category: 'dairy',        unit: '200 g',   price: 90  },
    { name: 'Amul Curd',              brand: 'Amul',          category: 'dairy',        unit: '400 g',   price: 40  },
    { name: 'Amul Cheese Slices',     brand: 'Amul',          category: 'dairy',        unit: '10 slices', price: 125 },
    { name: 'Amul Fresh Cream',       brand: 'Amul',          category: 'dairy',        unit: '250 ml',  price: 75  },
    { name: 'Amul Ghee',              brand: 'Amul',          category: 'dairy',        unit: '500 ml',  price: 310 },
    { name: 'Mother Dairy Curd',      brand: 'Mother Dairy',  category: 'dairy',        unit: '400 g',   price: 38  },
    { name: 'Buttermilk',             brand: 'Amul',          category: 'dairy',        unit: '200 ml',  price: 20  },
    { name: 'Amul Masti Dahi',        brand: 'Amul',          category: 'dairy',        unit: '1 kg',    price: 80  },
    { name: 'Condensed Milk',         brand: 'Milkmaid',      category: 'dairy',        unit: '400 g',   price: 120 },
    { name: 'Skimmed Milk Powder',    brand: 'Amul',          category: 'dairy',        unit: '500 g',   price: 230 },
    { name: 'Chocolate Milkshake',    brand: 'Amul',          category: 'dairy',        unit: '200 ml',  price: 35  },
    { name: 'Amul Lassi',             brand: 'Amul',          category: 'dairy',        unit: '200 ml',  price: 30  },
  ],

  hardware: [
    { name: 'Claw Hammer',            brand: 'Stanley',       category: 'hardware',     unit: '1 piece', price: 350 },
    { name: 'Nails Assorted Pack',    brand: 'Generic',       category: 'hardware',     unit: '100 g',   price: 60  },
    { name: 'Screwdriver Set (6 pcs)',brand: 'Stanley',       category: 'hardware',     unit: '6 pieces', price: 499 },
    { name: 'Measuring Tape 5m',      brand: 'Stanley',       category: 'hardware',     unit: '5 m',     price: 250 },
    { name: 'Combination Pliers',     brand: 'Stanley',       category: 'hardware',     unit: '1 piece', price: 320 },
    { name: 'PVC Electrical Tape',    brand: 'Generic',       category: 'hardware',     unit: '1 roll',  price: 40  },
    { name: 'M-Seal Epoxy',           brand: 'M-Seal',        category: 'hardware',     unit: '50 g',    price: 80  },
    { name: 'WD-40 Lubricant',        brand: 'WD-40',         category: 'hardware',     unit: '150 ml',  price: 250 },
    { name: 'Safety Work Gloves',     brand: 'Generic',       category: 'hardware',     unit: '1 pair',  price: 80  },
    { name: 'Paint Brush Set',        brand: 'Asian Paints',  category: 'hardware',     unit: '3 pieces', price: 120 },
    { name: 'Wall Putty',             brand: 'Birla',         category: 'hardware',     unit: '1 kg',    price: 90  },
    { name: 'Sandpaper 220 grit',     brand: 'Generic',       category: 'hardware',     unit: '5 sheets', price: 50 },
    { name: 'Cable Wire 1.5mm',       brand: 'Finolex',       category: 'hardware',     unit: '10 m',    price: 180 },
    { name: 'Wall Anchor Bolts',      brand: 'Generic',       category: 'hardware',     unit: '20 pieces', price: 60 },
    { name: 'Hacksaw Blade',          brand: 'Stanley',       category: 'hardware',     unit: '5 pieces', price: 120 },
  ],

  stationary: [
    { name: 'Classmate Notebook A4',  brand: 'Classmate',     category: 'stationary',   unit: '1 piece', price: 45  },
    { name: 'Ball Pen (Blue)',        brand: 'Reynolds',      category: 'stationary',   unit: '10 pens', price: 60  },
    { name: 'Pencil HB',              brand: 'Apsara',        category: 'stationary',   unit: '10 pieces', price: 40 },
    { name: 'Sticky Notes',           brand: '3M',            category: 'stationary',   unit: '100 sheets', price: 80 },
    { name: 'Stapler',                brand: 'Kangaro',       category: 'stationary',   unit: '1 piece', price: 150 },
    { name: 'Scissors (Large)',       brand: 'Kangaro',       category: 'stationary',   unit: '1 piece', price: 99  },
    { name: 'A4 Paper (500 sheets)',  brand: 'JK Copier',     category: 'stationary',   unit: '500 sheets', price: 299 },
    { name: 'Highlighter Set',        brand: 'Camlin',        category: 'stationary',   unit: '4 colors', price: 80 },
    { name: 'Correction Pen',         brand: 'Faber-Castell', category: 'stationary',   unit: '1 piece', price: 55  },
    { name: 'White Board Marker',     brand: 'Camlin',        category: 'stationary',   unit: '4 pieces', price: 90 },
    { name: 'Ruler 30cm',             brand: 'Classmate',     category: 'stationary',   unit: '1 piece', price: 30  },
    { name: 'Eraser',                 brand: 'Apsara',        category: 'stationary',   unit: '2 pieces', price: 20 },
    { name: 'Glue Stick',             brand: 'Fevi Stick',    category: 'stationary',   unit: '1 piece', price: 40  },
    { name: 'Envelope Pack',          brand: 'Generic',       category: 'stationary',   unit: '25 pieces', price: 50 },
    { name: 'File Folder',            brand: 'Solo',          category: 'stationary',   unit: '5 pieces', price: 80 },
  ],

  other: [
    { name: 'Mineral Water',          brand: 'Bisleri',       category: 'beverages',    unit: '1 L',     price: 20  },
    { name: 'Disposable Paper Cups',  brand: 'Generic',       category: 'household',    unit: '50 pieces', price: 80 },
    { name: 'Candle',                 brand: 'Generic',       category: 'household',    unit: '6 pieces', price: 40 },
    { name: 'Match Box',              brand: 'Homelite',      category: 'household',    unit: '10 boxes', price: 30 },
    { name: 'Incense Sticks',         brand: 'Cycle',         category: 'household',    unit: '1 pack',  price: 45  },
    { name: 'Zip Lock Bags',          brand: 'Generic',       category: 'household',    unit: '50 pieces', price: 60 },
    { name: 'Garbage Bags',           brand: 'Tuffbag',       category: 'household',    unit: '30 pieces', price: 80 },
    { name: 'Tissue Box',             brand: 'Kleenex',       category: 'household',    unit: '100 sheets', price: 75 },
    { name: 'Air Freshener',          brand: 'Odonil',        category: 'household',    unit: '50 g',    price: 65  },
    { name: 'Mosquito Coil',          brand: 'Good Knight',   category: 'household',    unit: '10 coils', price: 50 },
    { name: 'Floor Cleaner',          brand: 'Lizol',         category: 'household',    unit: '500 ml',  price: 120 },
    { name: 'Dishwash Bar',           brand: 'Vim',           category: 'household',    unit: '200 g',   price: 35  },
    { name: 'Broom',                  brand: 'Generic',       category: 'household',    unit: '1 piece', price: 80  },
    { name: 'Mop Refill',             brand: 'Generic',       category: 'household',    unit: '1 piece', price: 120 },
    { name: 'Phenyl Liquid',          brand: 'Robin',         category: 'household',    unit: '1 L',     price: 80  },
  ],
}

// ─── Seed a new shop's catalogue based on its category ───────────────────────

export async function seedShopCatalogue(shopId: string, shopCategory: string): Promise<void> {
  const products = CATALOGUE[shopCategory] ?? CATALOGUE['other']

  for (const p of products) {
    // 1. Upsert master product (match on exact name — skip insert if exists)
    let master = await db('master_products').where({ name: p.name }).first()

    if (!master) {
      const [inserted] = await db('master_products')
        .insert({
          name:        p.name,
          brand:       p.brand,
          category:    p.category,
          unit:        p.unit,
          description: p.description ?? null,
          is_approved: true,
        })
        .returning('*')
      master = inserted
    }

    // 2. Link to shop (skip if already linked)
    await db.raw(`
      INSERT INTO shop_products (id, shop_id, master_product_id, price, stock_status, is_visible)
      VALUES (uuid_generate_v4(), ?, ?, ?, 'in_stock', true)
      ON CONFLICT (shop_id, master_product_id) DO NOTHING
    `, [shopId, master.id, p.price])
  }
}
