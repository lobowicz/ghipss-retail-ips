### DB Tables
- `users`
- `otps` (removed) 
- `orders`
- `transactions`

### Building Authentication & OTP Endpoints
- `POST /auth/signup`: Merchant or customer signs up with name, email, phone, PIN, and Ghana-Card image; we hash the PIN, store the user, generate an OTP, send it via Twilio SMS, and save the hashed OTP in the DB.
- `POST /auth/verify-otp`: User submits phone + OTP; we hash‐compare, mark them verified, and delete the OTP record.
- `POST /auth/login`: User logs in with phone + PIN; we check verification, compare PIN, issue a JWT.
- `authMiddleware`: Protect routes by verifying the JWT in the Authorization header.

- `POST /orders`: 
