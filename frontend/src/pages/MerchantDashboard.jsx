import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './MerchantDashboard.css';

export default function MerchantDashboard() {
  const [orderID, setOrderID] = useState('');
  const [amount, setAmount] = useState('');
  const [qrData, setQrData] = useState(null);
  const [error, setError] = useState('');

  const createOrder = async e => {
    e.preventDefault();
    try {
      const res = await api.post('/orders', {
        orderID, amount: parseFloat(amount)
      });
      setQrData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Order creation failed');
    }
  };

  return (
    <div className="merchant-container">
      <div className="merchant-card">
        <h1 className="merchant-title">Merchant Dashboard</h1>
        
        <form className="merchant-form" onSubmit={createOrder}>
          <input className="merchant-input" placeholder="Order ID" value={orderID} onChange={e => setOrderID(e.target.value)} required />
          <input className="merchant-input" type="number" step="0.01" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} required />
          <button className="merchant-button" type="submit">Generate QR</button>
        </form>

        {error && <div className="merchant-error">{error}</div>}
        
        {qrData && (
          <div className="qr-section">
            <h2 className="qr-title">Payment QR Code Generated</h2>
            <div className="qr-txn-id">Transaction ID: {qrData.txnID}</div>
            <div className="qr-code">
              <img src={qrData.qrImage} alt="QR Code" />
            </div>
            <div className="qr-instructions">
              <strong>Instructions:</strong><br />
              Have customer visit /scan-pay or open the Scan app to complete the payment.
            </div>
          </div>
        )}

        <Link to="/reconciliation" className="reconciliation-link">Go to Reconciliation Dashboard</Link>
      </div>
    </div>
  );
}
