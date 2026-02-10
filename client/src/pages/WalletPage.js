import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCcw,
  DollarSign,
  AlertCircle,
  Loader,
  Check,
} from 'lucide-react';
import api from '../api';
import './WalletPage.css';

const PRESET_AMOUNTS = [5, 10, 20, 50];

/* ---- Helpers ---- */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function txIcon(type) {
  const t = (type || '').toLowerCase();
  if (t === 'topup' || t === 'top_up' || t === 'credit' || t === 'deposit') {
    return <ArrowDownCircle size={18} className="wp-tx-icon-credit" />;
  }
  if (t === 'refund') {
    return <RefreshCcw size={18} className="wp-tx-icon-credit" />;
  }
  return <ArrowUpCircle size={18} className="wp-tx-icon-debit" />;
}

function txSign(type) {
  const t = (type || '').toLowerCase();
  if (t === 'topup' || t === 'top_up' || t === 'credit' || t === 'deposit' || t === 'refund') {
    return '+';
  }
  return '-';
}

function txColorClass(type) {
  const t = (type || '').toLowerCase();
  if (t === 'topup' || t === 'top_up' || t === 'credit' || t === 'deposit' || t === 'refund') {
    return 'wp-tx-amount-credit';
  }
  return 'wp-tx-amount-debit';
}

export default function WalletPage() {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState('');
  const [topupSuccess, setTopupSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [balData, txData] = await Promise.all([
        api.payments.balance(),
        api.payments.history(),
      ]);
      setBalance(balData.balance ?? balData.amount ?? balData ?? 0);
      setTransactions(txData.transactions || txData.payments || txData || []);
    } catch (err) {
      setError(err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTopup = async (amount) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setTopupError('Enter a valid amount');
      return;
    }
    setTopupLoading(true);
    setTopupError('');
    setTopupSuccess(false);
    try {
      await api.payments.topup(value);
      setTopupSuccess(true);
      setTopupAmount('');
      await fetchData();
      setTimeout(() => setTopupSuccess(false), 2500);
    } catch (err) {
      setTopupError(err.message || 'Top-up failed');
    } finally {
      setTopupLoading(false);
    }
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="wallet-page">
        <div className="wp-loading">
          <Loader size={32} className="wp-spinner" />
          <p>Loading wallet...</p>
        </div>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error && balance === null) {
    return (
      <div className="wallet-page">
        <div className="wp-error-state">
          <AlertCircle size={40} color="var(--error)" />
          <p>{error}</p>
          <button className="wp-retry-btn" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const numBalance = typeof balance === 'object' ? 0 : Number(balance);

  return (
    <div className="wallet-page">
      {/* Balance card */}
      <div className="wp-balance-card">
        <div className="wp-balance-label">
          <Wallet size={20} /> Your Balance
        </div>
        <div className="wp-balance-amount">
          ${numBalance.toFixed(2)}
        </div>
      </div>

      {/* Add funds */}
      <div className="wp-section">
        <h2 className="wp-section-title">
          <Plus size={18} /> Add Funds
        </h2>

        <div className="wp-preset-grid">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              className="wp-preset-btn"
              onClick={() => handleTopup(amt)}
              disabled={topupLoading}
            >
              ${amt}
            </button>
          ))}
        </div>

        <div className="wp-custom-topup">
          <div className="wp-custom-input-wrapper">
            <DollarSign size={16} className="wp-custom-icon" />
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Custom amount"
              value={topupAmount}
              onChange={(e) => {
                setTopupAmount(e.target.value);
                setTopupError('');
              }}
              disabled={topupLoading}
            />
          </div>
          <button
            className="wp-custom-btn"
            onClick={() => handleTopup(topupAmount)}
            disabled={topupLoading || !topupAmount}
          >
            {topupLoading ? (
              <Loader size={16} className="wp-spinner" />
            ) : (
              'Add'
            )}
          </button>
        </div>

        {topupError && (
          <div className="wp-topup-error">
            <AlertCircle size={14} /> {topupError}
          </div>
        )}
        {topupSuccess && (
          <div className="wp-topup-success">
            <Check size={14} /> Funds added successfully!
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="wp-section">
        <h2 className="wp-section-title">Payment History</h2>

        {transactions.length === 0 ? (
          <div className="wp-tx-empty">
            <p>No transactions yet.</p>
          </div>
        ) : (
          <div className="wp-tx-list">
            {transactions.map((tx, idx) => {
              const id = tx._id || tx.id || idx;
              const type = tx.type || tx.transaction_type || '';
              const amount = tx.amount ?? 0;
              const description = tx.description || tx.note || type;
              const date = tx.createdAt || tx.created_at || tx.date;

              return (
                <div key={id} className="wp-tx-item">
                  <div className="wp-tx-left">
                    {txIcon(type)}
                    <div className="wp-tx-info">
                      <span className="wp-tx-desc">{description}</span>
                      {date && (
                        <span className="wp-tx-date">
                          {formatDate(date)} at {formatTime(date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`wp-tx-amount ${txColorClass(type)}`}>
                    {txSign(type)}${Number(amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
