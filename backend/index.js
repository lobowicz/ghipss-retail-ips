require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const twilio = require('twilio');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });    
// configure Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verifySid = process.env.TWILIO_SERVICE_ID

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

// ENDPOINTS 
app.get('/', (req, res) => res.send('Backend is live!'));

// store user, hash PIN, save card image, send OTP SMS, store hashed OTP 
app.post('/auth/signup', upload.single('cardImage'), async (req, res) => {
  try {
    const { name, email, phone, pin } = req.body;
    const card_url = req.file.path;
    const pin_hash = await bcrypt.hash(pin, 10);
    // 1. Insert unverified user
    const result = await db.query(
      `INSERT INTO users(name,email,phone,pin_hash,card_url,verified)
       VALUES($1,$2,$3,$4,$5,FALSE) RETURNING id`,
      [name, email, phone, pin_hash, card_url]
    );
    const userId = result.rows[0].id;
    // 2. Ask Twilio to send an OTP to that phone
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
    // 1. Ask Twilio to check the code
    const check = await client.verify.v2.services(verifySid)
      .verificationChecks
      .create({ to: '+18043977141', code }); 
    // 2. If Twilio says “approved” and "valid", mark user verified
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
    const payload = JSON.stringify({ txnID, orderID, amount });  // build the QR payload (JSON string)
    const qrImage = await QRCode.toDataURL(payload);  // generate a QR image as data-URI
    res.json({ txnID, qrImage });  // return to the frontend
  } catch (err) {
    console.error('Error creating order + QR:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Search: http://localhost:${PORT}`);
});
