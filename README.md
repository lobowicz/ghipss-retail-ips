---

## title: "InstantPay-Africa Sandbox"

# InstantPay-Africa Sandbox

A full-stack demo retail payment platform showcasing how small-to-medium retailers can integrate their checkout systems to generate dynamic, amount-locked QR codes and accept automated Mobile-Money or bank transfers.

# Project Overview

This sandbox environment enables medium-to-large businesses in Ghana to:

- **Register** with basic details and upload a Ghana Card image for KYC.
- **Connect** their checkout system by sending order details (orderID and amount).
- **Generate** a dynamic QR code that locks in the exact amount and a unique transaction ID.
- **Accept** customer payments through a simulated Mobile-Money API, initiated automatically when the QR is scanned.
- **Monitor** all transactions in real time via a live reconciliation dashboard.

The goal is to demonstrate a complete point-of-sale workflow for prototyping, training, or stakeholder presentations.

# Tech Stack

| Layer                | Tools & Libraries                                |
| -------------------- | ------------------------------------------------ |
| Backend              | Node.js, Express, Socket.IO, PostgreSQL (Docker) |
| Frontend             | React, React Router, Axios, react-qr-reader      |
| Authentication & SMS | JWT, bcrypt, Twilio Verify                       |
| QR Code              | `qrcode` (Node.js)                               |
| DevOps               | Docker, Docker Compose, GitHub Actions (CI/CD)   |

# Project Components

1. **Authentication & KYC**
   - Sign-up and login endpoints with JWT-secured sessions.
   - Phone verification using Twilio Verify SMS OTP.
2. **Order & QR Service**
   - API to receive order details and generate a Base64 QR Data-URI.
3. **Customer Payment Flow**
   - PWA page with camera-based QR scanner.
   - Payment confirmation screen and PIN entry.
4. **Mock Mobile-Money Service**
   - Simulated transfer endpoint with asynchronous callback.
5. **Transaction Engine**
   - Records pending transactions, handles callbacks, and updates status.
6. **Reconciliation Dashboard**
   - Real-time table of transactions using WebSockets for live updates.

# API Endpoints

## Authentication & KYC

- `POST /auth/signup`\
  Expects form-data: `name`, `email`, `phone`, `pin`, `cardImage`. Creates an unverified user and sends an OTP.
- `POST /auth/verify-otp`\
  Expects JSON: `{ phone, code }`. Verifies SMS OTP and marks the user as verified.
- `POST /auth/login`\
  Expects JSON: `{ phone, pin }`. Returns a JWT for authenticated requests.

## Order & QR Generation

- `POST /orders`\
  Protected. Expects JSON: `{ orderID, amount }`. Creates an order record and returns `{ txnID, qrImage }`.
- `GET /orders/:txnID`\
  Protected. Returns order details: `{ orderID, amount, merchantName, merchantPhone }`.

## Payments & Mock Mobile-Money

- `POST /pay`\
  Protected. Expects JSON: `{ txnID, pin }`. Creates a pending transaction and calls `/momo/transfer`.
- `POST /momo/transfer`\
  Internal mock. Expects JSON: `{ fromAcct, toAcct, amount, txnRef }`. Returns `{ status: 'pending' }` and triggers `/momo/callback`.
- `POST /momo/callback`\
  Internal mock. Expects JSON: `{ txnRef, status }`. Updates transaction status in the database.

## Reconciliation

- `GET /transactions`\
  Protected. Returns all transactions: `{ orderID, txnID, amount, status, timestamp }`, sorted by timestamp.
- **WebSocket Events:**
  - `transactionCreated` when a new pending transaction is recorded.
  - `transactionUpdated` when a transaction’s status changes.
