import express, { Response } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from './db';
import { logEvent } from './logger';
import { AuthRequest, authenticate, requireAdmin } from './middleware';

const app = express();
const PORT = process.env.PORT || 80;
const JWT_SECRET = process.env.JWT_SECRET || 'merchandise_shop_secret_key';

// Middlewares
app.use(cors());
app.use(express.json());

// Serving product images from local /assets
app.use('/assets', express.static(path.resolve(__dirname, '../../assets')));

// Helper: Download external image
function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const assetsDir = path.resolve(__dirname, '../../assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const dest = path.join(assetsDir, filename);
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (Status: ${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(`/assets/${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // cleanup partial file
      reject(err);
    });
  });
}

// ------------------- AUTHENTICATION ENDPOINTS -------------------

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertRes = await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hash, 'user']
    );

    const user = insertRes.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    logEvent(`[Auth] User registered successfully: ${email}`);
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      logEvent(`[Auth] Failed login attempt: email '${email}' not found`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      logEvent(`[Auth] Failed login attempt: invalid password for '${email}'`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    logEvent(`[Auth] Successful login for: ${email}`);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3', [token, expires, email]);
    logEvent(`[Auth] Password recovery requested for: ${email}`);

    res.json({ message: 'Password recovery token generated', token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const userRes = await query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
      [token]
    );

    if (userRes.rows.length === 0) {
      logEvent(`[Auth] Failed password reset: invalid or expired token`);
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const user = userRes.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [hash, user.id]
    );

    logEvent(`[Auth] Successful password reset for user: ${user.email}`);
    res.json({ message: 'Password reset successful' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- PRODUCT SHOWCASE ENDPOINTS -------------------

app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, sortBy } = req.query;
    let queryText = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (category) {
      params.push(category);
      queryText += ` AND category = $${params.length}`;
    }
    if (minPrice) {
      params.push(Number(minPrice));
      queryText += ` AND price >= $${params.length}`;
    }
    if (maxPrice) {
      params.push(Number(maxPrice));
      queryText += ` AND price <= $${params.length}`;
    }

    if (sortBy === 'price_asc') {
      queryText += ' ORDER BY price ASC';
    } else if (sortBy === 'price_desc') {
      queryText += ' ORDER BY price DESC';
    } else {
      queryText += ' ORDER BY id ASC';
    }

    const productsRes = await query(queryText, params);
    res.json(productsRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const productRes = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(productRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- CHECKOUT & INVENTORY -------------------

app.post('/api/checkout', async (req: AuthRequest, res) => {
  const { name, address, phone, paymentMethod, items } = req.body;
  if (!name || !address || !phone || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Incomplete shipping or order details' });
  }

  // Optional Authentication check: get user_id if token is valid
  let userId: number | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.id;
    } catch (e) {
      // Allow guest checkout if they pass invalid token, but clean it up
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const orderItemsToInsert = [];

    // Verify stock and fetch prices
    for (const item of items) {
      const { productId, quantity, size } = item;
      if (!productId || !quantity || quantity <= 0 || !size) {
        throw new Error('Invalid cart item structure');
      }

      // Lock row for update
      const prodRes = await client.query(
        'SELECT name, price, stock, sizes FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Product ID ${productId} not found`);
      }

      const product = prodRes.rows[0];

      if (!product.sizes.includes(size)) {
        throw new Error(`Size '${size}' is not available for product '${product.name}'`);
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock for product '${product.name}'. Available: ${product.stock}, Requested: ${quantity}`);
      }

      const price = Number(product.price);
      totalAmount += price * quantity;

      // Decrement stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [quantity, productId]
      );

      orderItemsToInsert.push({
        productId,
        quantity,
        price,
        size
      });
    }

    // Insert order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, customer_name, customer_address, customer_phone, payment_method, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, name, address, phone, paymentMethod, totalAmount, 'New']
    );

    const orderId = orderRes.rows[0].id;

    // Insert order items
    for (const orderItem of orderItemsToInsert) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, orderItem.productId, orderItem.quantity, orderItem.price, orderItem.size]
      );
    }

    await client.query('COMMIT');

    logEvent(`[Checkout] Order #${orderId} placed successfully by ${name}. Total: $${totalAmount.toFixed(2)}`);
    res.status(201).json({ orderId, totalAmount });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// User orders list
app.get('/api/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const ordersRes = await query(
      `SELECT o.*, 
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', oi.id,
            'product_id', oi.product_id,
            'name', p.name,
            'image_url', p.image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'size', oi.size
          )
        ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user!.id]
    );
    res.json(ordersRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- ADMIN DASHBOARD ENDPOINTS -------------------

// Admin: Get all orders
app.get('/api/orders/all', requireAdmin, async (req, res) => {
  try {
    const ordersRes = await query(
      `SELECT o.*, 
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', oi.id,
            'product_id', oi.product_id,
            'name', p.name,
            'image_url', p.image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'size', oi.size
          )
        ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json(ordersRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update order status
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['New', 'Confirmed', 'Shipped', 'Delivered'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Choose from: ${validStatuses.join(', ')}` });
  }

  try {
    const orderRes = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id', [status, req.params.id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    logEvent(`[Admin] Order #${req.params.id} status updated to: ${status}`);
    res.json({ message: 'Order status updated successfully', orderId: req.params.id, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Add product with image download
app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, description, price, category, imageUrl, sizes, stock } = req.body;
  if (!name || !price || !category || !imageUrl || !sizes || stock === undefined) {
    return res.status(400).json({ error: 'Missing required product parameters' });
  }

  try {
    // Download image locally
    const fileExt = path.extname(imageUrl.split('?')[0]) || '.png';
    const localFilename = `custom_${Date.now()}${fileExt}`;
    
    console.log(`Downloading external image from '${imageUrl}'...`);
    const localPath = await downloadImage(imageUrl, localFilename);
    console.log(`Image downloaded and saved to: ${localPath}`);

    const resProd = await query(
      `INSERT INTO products (name, description, price, category, image_url, sizes, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, Number(price), category, localPath, sizes, Number(stock)]
    );

    logEvent(`[Admin] Product created: '${name}' with price $${Number(price).toFixed(2)}`);
    res.status(201).json(resProd.rows[0]);
  } catch (err: any) {
    logEvent(`[Admin] Failed to create product. Error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// Admin: Edit product (checks for price changes)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { name, description, price, category, imageUrl, sizes, stock } = req.body;
  if (!name || !price || !category || !sizes || stock === undefined) {
    return res.status(400).json({ error: 'Missing required product parameters' });
  }

  try {
    // Get existing product to check price change
    const existRes = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentProd = existRes.rows[0];
    const oldPrice = Number(currentProd.price);
    const newPrice = Number(price);

    let finalImageUrl = currentProd.image_url;
    if (imageUrl && imageUrl !== currentProd.image_url && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      // Download new image
      const fileExt = path.extname(imageUrl.split('?')[0]) || '.png';
      const localFilename = `custom_${Date.now()}${fileExt}`;
      finalImageUrl = await downloadImage(imageUrl, localFilename);
    } else if (imageUrl) {
      finalImageUrl = imageUrl;
    }

    const updateRes = await query(
      `UPDATE products 
       SET name = $1, description = $2, price = $3, category = $4, image_url = $5, sizes = $6, stock = $7
       WHERE id = $8 RETURNING *`,
      [name, description, newPrice, category, finalImageUrl, sizes, Number(stock), req.params.id]
    );

    if (oldPrice !== newPrice) {
      logEvent(`[Admin] Product '${name}' (ID: ${req.params.id}) price changed from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)}`);
    } else {
      logEvent(`[Admin] Product '${name}' (ID: ${req.params.id}) updated`);
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const existRes = await query('SELECT name FROM products WHERE id = $1', [req.params.id]);
    if (existRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const name = existRes.rows[0].name;

    await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    logEvent(`[Admin] Product deleted: '${name}' (ID: ${req.params.id})`);

    res.json({ message: 'Product deleted successfully', productId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- FRONTEND STATIC SERVING (PRODUCTION) -------------------

const frontendBuildPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

app.get('*', (req, res) => {
  const indexFile = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('React Build not found. Please compile frontend assets.');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  logEvent(`[System] Express server started on port ${PORT}`);
});
