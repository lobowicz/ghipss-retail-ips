import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import api from '../api';
import './Reconciliation.css';

export default function Reconciliation() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // fetch initial list
    api.get('/transactions')
      .then(res => {
        setTransactions(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load transactions');
        setLoading(false);
      });

    // connect to Socket.IO
    const socket = io(); // picks up baseURL automatically

    // handle new transactions
    socket.on('transactionCreated', tx => {
      setTransactions(prev => [tx, ...prev]);
    });

    // handle updates
    socket.on('transactionUpdated', updatedTx => {
      setTransactions(prev =>
        prev.map(tx =>
          tx.txnID === updatedTx.txnID ? updatedTx : tx
        )
      );
    });

    return () => socket.disconnect();
  }, []);

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'success': return 'status-success';
      case 'failed': return 'status-failed';
      default: return 'status-default';
    }
  };

  const getRowClass = (status) => {
    switch (status) {
      case 'pending': return 'row-pending';
      case 'success': return 'row-success';
      case 'failed': return 'row-failed';
      default: return 'row-default';
    }
  };

  return (
    <div className="reconciliation-container">
      <div className="reconciliation-card">
        <div className="reconciliation-header">
          <h1 className="reconciliation-title">Reconciliation Dashboard</h1>
          <div className="reconciliation-stats">
            <div className="stat-item">
              <span className="stat-number">{transactions.length}</span>
              <span className="stat-label">Total Transactions</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{transactions.filter(tx => tx.status === 'success').length}</span>
              <span className="stat-label">Successful</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{transactions.filter(tx => tx.status === 'pending').length}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        </div>

        {error && <div className="reconciliation-error">{error}</div>}

        {loading ? (
          <div className="reconciliation-loading">
            <div className="loading-spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="reconciliation-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Transaction ID</th>
                  <th>Amount (₵)</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.txnID} className={getRowClass(tx.status)}>
                      <td className="order-id">{tx.orderID}</td>
                      <td className="txn-id">{tx.txnID}</td>
                      <td className="amount">₵{parseFloat(tx.amount).toFixed(2)}</td>
                      <td className="timestamp">{new Date(tx.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}