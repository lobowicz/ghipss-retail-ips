require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const twilio = require('twilio');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 4000;

// configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });    
// configure Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verifySid = process.env.TWILIO_SERVICE_SID;

// wrap Express in a raw HTTP server
const server = http.createServer(app);                  // server
const io = socketIo(server, { cors: { origin: '*' } }); 
io.on('connection', socket => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// define auth middleware - protects routes by checking for a valid JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid Authorization format' });
  }

  const token = parts[1];
  try {
    // verify the JWT using your secret
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // attach the user ID to the request object
    req.userId = payload.userId;
    // continue on to the protected route handler
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// API ENDPOINTS 
// basic check
app.get('/', (req, res) => res.send('Backend is live!'));

// store user, hash PIN, save card image, send OTP SMS, store hashed OTP 
app.post('/auth/signup', upload.single('cardImage'), async (req, res) => {
  try {
    const { name, email, phone, pin } = req.body;
    const card_url = req.file.path;
    // check if user already exists
    const existUser = await db.query(`SELECT id FROM users WHERE email = $1 OR phone = $2`, [email, phone]);
    if (existUser.rows.length > 0) return res.status(400).json({ error: "User with this email or phone number already exists." });
    const pin_hash = await bcrypt.hash(pin, 10); 
    // insert unverified user
    const result = await db.query(
      `INSERT INTO users(name,email,phone,pin_hash,card_url,verified)
       VALUES($1,$2,$3,$4,$5,FALSE) RETURNING id`,
      [name, email, phone, pin_hash, card_url]
    );
    const userId = result.rows[0].id;
    // ask Twilio to send an OTP to that phone
    await client.verify.v2.services(verifySid)
      .verifications
      .create({ to: '+18043977141', channel: 'sms' }); // use test number for now
    res.status(200).json({ message: 'Signup OK – OTP sent via SMS' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// verify-OTP using Twilio API: check code, mark user verified 
app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    // ask Twilio to check the code
    const check = await client.verify.v2.services(verifySid)
      .verificationChecks
      .create({ to: '+18043977141', code }); 
    // if Twilio says “approved” and "valid", mark user verified
    if (check.status === 'approved' && check.valid == true) {
      await db.query(`UPDATE users SET verified = TRUE WHERE phone = $1`, [phone]);
      return res.json({ message: 'Phone verified! You can now log in.' });
    } else {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// login: verify user + PIN, issue JWT 
app.post('/auth/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const userRes = await db.query(
      `SELECT id, pin_hash, verified FROM users WHERE phone=$1`,
      [phone]
    );
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Phone not registered. Sign up for free.' });
    }
    const user = userRes.rows[0];
    if (!user.verified) {
      return res.status(400).json({ error: 'Phone not verified.' });
    }
    // compare PIN
    if (!(await bcrypt.compare(pin, user.pin_hash))) {
      return res.status(400).json({ error: 'Incorrect details. Check your number and retype PIN.' });
    }
    // sign JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// merchant calls this on an order they have with { orderID, amount }
// we verify the merchant's JWT, generate unique trans. ID (txnID) and insert row into `orders` table
// convert { txnID, orderID, amount } into a QR-code
app.post('/orders', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.userId;          // from JWT
    const { orderID, amount } = req.body;
    if (!orderID || !amount) {
      return res.status(400).json({ error: 'OrderID and amount required.' });
    }

    const txnID = uuidv4(); // generate a unique txnID
    await db.query(     // save the order record
      `INSERT INTO orders(order_id, merchant_id, amount, txn_id)
       VALUES ($1, $2, $3, $4)`,
      [orderID, merchantId, amount, txnID]
    );
    const payload = JSON.stringify({ 
        txnID, orderID, amount 
    });  // build the QR payload (JSON string)
    const qrImage = await QRCode.toDataURL(payload);  // generate a QR image as data-URI
    res.json({ txnID, qrImage });  // return to the frontend
  } catch (err) {
    console.error('Error creating order + QR:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

// get order details { orderID, amount, merchantName, merchantPhone } for a transactionID
app.get('/orders/:txnID', async (req, res) => {
  try {
    const { txnID } = req.params;
    const result = await db.query(`
      SELECT 
        o.order_id   AS "orderID",
        o.amount,
        u.name       AS "merchantName",
        u.phone      AS "merchantPhone"
      FROM orders o
      JOIN users u 
        ON o.merchant_id = u.id
      WHERE o.txn_id = $1
    `, [txnID]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /orders/:txnID error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// payment initiation endpoint - after customer scans code and confirms
app.post('/pay', authMiddleware, async (req, res) => {
  try {
    const customerId = req.userId;        // from JWT
    const { txnID, pin } = req.body;
    if (!txnID || !pin) return res.status(400).json({ error: 'txnID and PIN are required' });

    // verify PIN
    const userRes = await db.query(
      `SELECT pin_hash, phone FROM users WHERE id = $1`,
      [customerId]
    );
    const user = userRes.rows[0];
    if (!user || !(await bcrypt.compare(pin, user.pin_hash))) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    // fetch order & merchant info
    const orderRes = await db.query(
        `SELECT id AS order_ref, order_id AS "orderID", amount, merchant_id
        FROM orders WHERE txn_id = $1`,
      [txnID]
    );
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const { order_ref, amount, merchant_id } = orderRes.rows[0];
    // create pending transaction record
    await db.query(
      `INSERT INTO transactions(txn_id, order_ref, customer_id, status)
       VALUES($1, $2, $3, 'pending')`,
      [txnID, order_ref, customerId]
    );

    // emit on a new transaction 
    io.emit('transactionCreated', {
        txnID,
        orderID,        
        amount,
        status: 'pending',
        timestamp: new Date().toISOString()
    });

    // look up MoMo account numbers (we’re using phone as acct here)
    const fromAcct = user.phone;
    const merchantRes = await db.query(`SELECT phone AS toAcct FROM users WHERE id = $1`, [merchant_id]);
    const toAcct = merchantRes.rows[0].phone; // phone field

    // call the mock MoMo service to transfer funds
    await axios.post(`http://localhost:${PORT}/momo/transfer`, {
      fromAcct,
      toAcct,
      amount,
      txnRef: txnID
    });
    // immediately respond to the client
    return res.json({ status: 'pending', txnID });
  } catch (err) {
    console.error('Error in /pay:', err);
    return res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// get all transactions with their orderID, amount, timestamp, status
app.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
        SELECT o.order_id AS "orderID",
             t.txn_id AS "txnID",
             o.amount,
             t.status,
             t.created_at AS "timestamp"
        FROM transactions t
        JOIN orders o ON t.order_ref = o.id
        ORDER BY t.created_at DESC
        `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /transactions error:', err);
    res.status(500).json({ error: 'Could not fetch transactions' });
  }
});

// mock MoMo transfer endpoint
app.post('/momo/transfer', async (req, res) => {
  const { fromAcct, toAcct, amount, txnRef } = req.body;
  // immediately acknowledge the transfer request
  res.json({ status: 'pending', txnRef });
  // after 3 seconds, simulate MoMo API approving transaction has been sent with success
  setTimeout(() => {
    axios.post(`http://localhost:${PORT}/momo/callback`, {
      txnRef,
      status: 'success'
    }).catch(err => console.error('Callback error:', err));
  }, 3000);
});

// mock MoMo callback handler
app.post('/momo/callback', async (req, res) => {
  const { txnRef, status } = req.body;
  try {
    // update the transaction’s status in the DB
    await db.query(
      `UPDATE transactions
         SET status = $1
       WHERE txn_id = $2`,
      [status, txnRef]
    );

    // after status update, get the transaction details ...
    const tx = await db.query(`
        SELECT o.order_id AS "orderID", o.amount, t.txn_id AS "txnID",
            t.status, t.created_at AS "timestamp"
        FROM transactions t
        JOIN orders o ON t.order_ref = o.id
        WHERE t.txn_id = $1`, [txnRef]);
    // ... then, emit the updated transaction
    if (tx.rows[0]) {
        io.emit('transactionUpdated', tx.rows[0]);
    }

    return res.json({ message: 'Transaction status updated' });
  } catch (err) {
    console.error('Error in /momo/callback:', err);
    return res.status(500).json({ error: 'Callback handler failed' });
  }
});


// START SERVER AND WEB SOCKET
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Search: http://localhost:${PORT}`);
});
