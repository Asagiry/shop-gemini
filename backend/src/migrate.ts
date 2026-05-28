import { pool } from './db';
import bcrypt from 'bcryptjs';

async function main() {
  const client = await pool.connect();
  try {
    console.log('Starting migrations and database seeding...');

    // Drop existing tables in reverse order of dependencies
    await client.query('DROP TABLE IF EXISTS order_items CASCADE');
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    console.log('Dropped existing tables.');

    // Create tables
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        reset_token VARCHAR(255),
        reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    console.log('Created table: users');

    await client.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        sizes VARCHAR(50)[] DEFAULT '{}'::VARCHAR[] NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    console.log('Created table: products');

    await client.query(`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_address TEXT NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'New' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    console.log('Created table: orders');

    await client.query(`
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        size VARCHAR(50) NOT NULL
      )
    `);
    console.log('Created table: order_items');

    // Seed users
    const adminHash = await bcrypt.hash('admin', 10);
    const user1Hash = await bcrypt.hash('password', 10);
    const user2Hash = await bcrypt.hash('password', 10);

    const userRes = await client.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES 
        ('admin', $1, 'admin'),
        ('user1@example.com', $2, 'user'),
        ('user2@example.com', $3, 'user')
      RETURNING id, email
    `, [adminHash, user1Hash, user2Hash]);

    const usersMap: Record<string, number> = {};
    userRes.rows.forEach(row => {
      usersMap[row.email] = row.id;
    });

    console.log('Seeded users.');

    // Seed products (15 items)
    const productsSeed = [
      {
        name: 'Vibe Miner Classic Tee',
        description: 'Rep the mines in style with this official Vibe Miner classic t-shirt. Featuring high-quality print and premium soft cotton.',
        price: 25.00,
        category: 'clothing',
        image_url: '/assets/tshirt_vibe_miner.png',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 100
      },
      {
        name: 'Pixel Heart T-Shirt',
        description: 'Show your retro gaming love with this premium Pixel Heart tee. Made from 100% combed ringspun cotton.',
        price: 22.00,
        category: 'clothing',
        image_url: '/assets/tshirt_pixel_heart.png',
        sizes: ['S', 'M', 'L'],
        stock: 80
      },
      {
        name: 'Synthwave Neon T-Shirt',
        description: 'Vibrant neon graphics inspired by late 80s aesthetics. Bring the synthwave sun to your wardrobe.',
        price: 24.50,
        category: 'clothing',
        image_url: '/assets/tshirt_synthwave.png',
        sizes: ['M', 'L', 'XL'],
        stock: 50
      },
      {
        name: 'Game Over Retro Tee',
        description: 'A classic "Game Over" layout in true 8-bit style. Perfect for casual gaming sessions or just chilling.',
        price: 20.00,
        category: 'clothing',
        image_url: '/assets/tshirt_game_over.png',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 120
      },
      {
        name: 'Cyber Cat Neon Tee',
        description: 'A futuristic cybernetic feline design. Glows under blacklight and stands out anywhere.',
        price: 26.00,
        category: 'clothing',
        image_url: '/assets/tshirt_cyber_cat.png',
        sizes: ['S', 'M', 'L'],
        stock: 65
      },
      {
        name: 'Loading... Patience Tee',
        description: 'For those days when your brain is still rendering. Simple, sleek, and highly relatable loading bar design.',
        price: 19.99,
        category: 'clothing',
        image_url: '/assets/tshirt_loading_bar.png',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 90
      },
      {
        name: 'Retro Gamepad Tee',
        description: 'Honor the controllers of yesteryears. High-quality outline print of a legendary retro gamepad.',
        price: 23.00,
        category: 'clothing',
        image_url: '/assets/tshirt_retro_gamepad.png',
        sizes: ['M', 'L', 'XL'],
        stock: 75
      },
      {
        name: 'Glitch Skull Tee',
        description: 'An edgy glitch-art skull design merging retro technology and dark alternative fashion.',
        price: 27.00,
        category: 'clothing',
        image_url: '/assets/tshirt_glitch_skull.png',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 40
      },
      {
        name: 'Space Invader Tee',
        description: 'Defend Earth in this vintage-styled arcade classic space alien invader t-shirt.',
        price: 21.50,
        category: 'clothing',
        image_url: '/assets/tshirt_space_invader.png',
        sizes: ['S', 'M', 'L'],
        stock: 110
      },
      {
        name: 'D20 Critical Hit Tee',
        description: 'Roll a natural 20 with this premium table-top roleplaying gaming D20 dice t-shirt.',
        price: 28.00,
        category: 'clothing',
        image_url: '/assets/tshirt_d20_dice.png',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 35
      },
      // 5 extra posters/items
      {
        name: 'Vibe Miner Neon Poster',
        description: 'Brighten up your room with this high-gloss neon style poster featuring Vibe Miner art.',
        price: 12.99,
        category: 'posters',
        image_url: '/assets/tshirt_vibe_miner.png',
        sizes: ['12x18', '18x24'],
        stock: 150
      },
      {
        name: 'Synthwave Sunset Poster',
        description: 'A beautiful grid sunset poster in high-fidelity colors. Perfect for synthwave enthusiasts.',
        price: 14.99,
        category: 'posters',
        image_url: '/assets/tshirt_synthwave.png',
        sizes: ['12x18', '18x24'],
        stock: 100
      },
      {
        name: 'Pixel Heart Sticker Pack',
        description: 'Set of 5 high-quality, water-resistant pixel heart stickers for your laptop or console.',
        price: 5.99,
        category: 'accessories',
        image_url: '/assets/tshirt_pixel_heart.png',
        sizes: ['Standard'],
        stock: 300
      },
      {
        name: 'Cyber Cat Mug',
        description: 'Start your morning coding session with the cyber cat mug. Dishwasher and microwave safe.',
        price: 16.50,
        category: 'accessories',
        image_url: '/assets/tshirt_cyber_cat.png',
        sizes: ['11oz', '15oz'],
        stock: 85
      },
      {
        name: 'Game Over Pin Badge',
        description: 'Enamel pin badge to show off on your backpack, jacket, or lanyard.',
        price: 4.99,
        category: 'accessories',
        image_url: '/assets/tshirt_game_over.png',
        sizes: ['Standard'],
        stock: 500
      }
    ];

    const insertedProducts: Array<{ id: number; price: number; name: string }> = [];

    for (const p of productsSeed) {
      const res = await client.query(`
        INSERT INTO products (name, description, price, category, image_url, sizes, stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, price, name
      `, [p.name, p.description, p.price, p.category, p.image_url, p.sizes, p.stock]);
      insertedProducts.push({
        id: res.rows[0].id,
        price: Number(res.rows[0].price),
        name: res.rows[0].name
      });
    }

    console.log('Seeded products.');

    // Seed 5 completed mock orders
    const mockOrders = [
      {
        userEmail: 'user1@example.com',
        customer_name: 'John Doe',
        customer_address: '123 Pixel Street, Retroville',
        customer_phone: '+1 555 123 4567',
        payment_method: 'Credit Card',
        items: [
          { prodIdx: 0, qty: 1, size: 'M' }, // Vibe Miner Classic Tee
          { prodIdx: 1, qty: 2, size: 'L' }  // Pixel Heart T-Shirt
        ],
        status: 'Delivered',
        created_offset_days: 10
      },
      {
        userEmail: 'user2@example.com',
        customer_name: 'Jane Smith',
        customer_address: '456 Cyber Avenue, Neo-Tokyo',
        customer_phone: '+81 90 1234 5678',
        payment_method: 'PayPal',
        items: [
          { prodIdx: 4, qty: 1, size: 'S' } // Cyber Cat Neon Tee
        ],
        status: 'Delivered',
        created_offset_days: 7
      },
      {
        userEmail: 'user1@example.com',
        customer_name: 'John Doe',
        customer_address: '123 Pixel Street, Retroville',
        customer_phone: '+1 555 123 4567',
        payment_method: 'Crypto',
        items: [
          { prodIdx: 9, qty: 1, size: 'XL' }, // D20 Critical Hit Tee
          { prodIdx: 12, qty: 1, size: 'Standard' } // Pixel Heart Sticker Pack
        ],
        status: 'Delivered',
        created_offset_days: 5
      },
      {
        userEmail: 'user2@example.com',
        customer_name: 'Jane Smith',
        customer_address: '456 Cyber Avenue, Neo-Tokyo',
        customer_phone: '+81 90 1234 5678',
        payment_method: 'Credit Card',
        items: [
          { prodIdx: 10, qty: 2, size: '18x24' } // Vibe Miner Neon Poster
        ],
        status: 'Delivered',
        created_offset_days: 3
      },
      {
        userEmail: 'user1@example.com',
        customer_name: 'John Doe',
        customer_address: '123 Pixel Street, Retroville',
        customer_phone: '+1 555 123 4567',
        payment_method: 'Credit Card',
        items: [
          { prodIdx: 2, qty: 1, size: 'XL' } // Synthwave Neon T-Shirt
        ],
        status: 'Delivered',
        created_offset_days: 1
      }
    ];

    for (const o of mockOrders) {
      const userId = usersMap[o.userEmail];
      let totalAmount = 0;
      
      // Calculate total amount
      for (const item of o.items) {
        const prod = insertedProducts[item.prodIdx];
        totalAmount += prod.price * item.qty;
      }

      const orderRes = await client.query(`
        INSERT INTO orders (user_id, customer_name, customer_address, customer_phone, payment_method, total_amount, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${o.created_offset_days} days')
        RETURNING id
      `, [userId, o.customer_name, o.customer_address, o.customer_phone, o.payment_method, totalAmount, o.status]);

      const orderId = orderRes.rows[0].id;

      for (const item of o.items) {
        const prod = insertedProducts[item.prodIdx];
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price, size)
          VALUES ($1, $2, $3, $4, $5)
        `, [orderId, prod.id, item.qty, prod.price, item.size]);
      }
    }

    console.log('Seeded mock orders.');
    console.log('Migration and seeding completed successfully!');
  } catch (err) {
    console.error('Error during migrations and seeding:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
