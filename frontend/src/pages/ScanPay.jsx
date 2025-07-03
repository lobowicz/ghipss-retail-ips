import { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import api from '../api';
import './ScanPay.css';

export default function ScanPay() {
  const [step, setStep] = useState(0);
  const [txnID, setTxnID] = useState('');
  const [order, setOrder] = useState(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  // scan QR
  const handleScan = data => {
    if (data) {
      const { txnID } = JSON.parse(data);
      setTxnID(txnID);
      setStep(1);
      // fetch merchant and order details
      api.get(`/orders/${txnID}`)
        .then(res => setOrder(res.data))
        .catch(() => setMessage('Failed to load order details.'));
    }
  };
  const handleError = err => console.error(err);

  // pay now
  const doPay = async () => {
    try {
      setMessage('Processing…');
      await api.post('/pay', { txnID, pin });
      setMessage('Payment pending... will update shortly');
      setStep(2);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payment failed.');
    }
  };

  // determine message CSS class based on content
  const getMessageClass = () => {
    if (message.includes('Processing')) return 'message processing';
    if (message.includes('pending') || message.includes('update shortly')) return 'message success';
    if (message.includes('failed') || message.includes('Failed')) return 'message error';
    return 'message';
  };

  return (
    <div className='scanpay-card'>
      <h1 className="scanpay-title">Scan & Pay</h1>

      {step === 0 && (
        <div className='qr-scanner-section'>
          <div className='qr-scanner-wrapper'>
            <QrReader delay={300} onError={handleError} onScan={handleScan} style={{ width: '100%' }} />
          </div>
          <p className="qr-scanner-instructions">
            Position the QR code within the scanner area to begin payment.
          </p>
        </div>
      )}

      {step === 1 && order && (
        <div className="payment-section">
          <div className="payment-amount">
            Pay ₵{order.amount.toFixed(2)}
          </div>
          
          <div className="payment-details">
            <div className="payment-merchant">
              Merchant: {order.merchantName} ({order.merchantPhone})
            </div>
            <div className="payment-order-id">
              Order ID: {order.orderID}
            </div>
          </div>
          
          <form className="payment-form" onSubmit={e => { e.preventDefault(); doPay(); }}>
            <input 
              className="payment-pin-input"
              type="password" 
              placeholder="Enter PIN" 
              value={pin} 
              onChange={e => setPin(e.target.value)}
              maxLength="4"
              required
            />
            <button className="payment-button" type="submit">Pay Now</button>
          </form>
        </div>
      )}

      {message && <div className={getMessageClass()}>{message}</div>}
    </div>
  );
}
