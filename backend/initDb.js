const db = require('./db');

async function setup() {
  try {
    await db.query(`TRUNCATE TABLE 
      users, orders, otps, transactions 
      RESTART IDENTITY CASCADE;`);
    console.log('All tables truncated.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        card_url TEXT,
        verified BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        merchant_id INT REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        txn_id TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        txn_id TEXT UNIQUE NOT NULL,
        order_ref INT REFERENCES orders(id) ON DELETE CASCADE,
        customer_id INT REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Tables created (or already exists)!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    db.pool.end();  // end the DB pool so the script exits
  }
}

setup();
