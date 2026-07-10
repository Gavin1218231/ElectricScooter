import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Zap,
  Battery,
  DollarSign,
  Clock,
  AlertCircle,
  Loader,
} from 'lucide-react';
import api from '../api';
import { useRental } from '../context/RentalContext';
import './ScooterDetail.css';

export default function ScooterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startRental, activeRental } = useRental();

  const [scooter, setScooter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);

  useEffect(() => {
    let cancelled = false;
    const fetchScooter = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.scooters.getById(id);
        if (!cancelled) {
          setScooter(data.scooter || data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load scooter details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchScooter();
    return () => { cancelled = true; };
  }, [id]);

  const battery = scooter?.battery_level ?? scooter?.batteryLevel ?? 0;
  const unlockFee = Number(scooter?.price_to_unlock ?? scooter?.unlock_fee ?? scooter?.unlockFee ?? 1.0);
  const pricePerMin = Number(scooter?.price_per_minute ?? scooter?.pricePerMinute ?? 0.25);
  const estimatedCost = unlockFee + estimatedMinutes * pricePerMin;
  const isAvailable =
    scooter &&
    (scooter.status === 'available' || scooter.status === undefined);

  const batteryColor = battery >= 60 ? '#00C853' : battery >= 30 ? '#FF9800' : '#f44336';

  const handleUnlock = async () => {
    if (unlocking) return;
    setUnlockError('');
    setUnlocking(true);
    try {
      await startRental(scooter._id || scooter.id);
      navigate('/ride');
    } catch (err) {
      setUnlockError(err.message || 'Failed to unlock scooter');
    } finally {
      setUnlocking(false);
    }
  };

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="scooter-detail">
        <div className="scooter-detail-loading">
          <Loader size={36} className="scooter-detail-spinner" />
          <p>Loading scooter details...</p>
        </div>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error) {
    return (
      <div className="scooter-detail">
        <div className="scooter-detail-error">
          <AlertCircle size={48} color="var(--error)" />
          <h2>Oops!</h2>
          <p>{error}</p>
          <Link to="/" className="scooter-detail-back-link">Back to Map</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="scooter-detail">
      {/* Header */}
      <div className="scooter-detail-header">
        <button className="scooter-detail-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>Scooter Details</h1>
      </div>

      {/* Scooter illustration area */}
      <div className="scooter-detail-hero">
        <div className="scooter-detail-icon-area">
          <Zap size={64} color="var(--primary)" />
        </div>
        <h2 className="scooter-detail-code">{scooter.code || scooter.scooterCode}</h2>
        <p className="scooter-detail-model">{scooter.model || 'Vim Scooter'}</p>
      </div>

      {/* Battery bar */}
      <div className="scooter-detail-card">
        <div className="scooter-detail-card-title">
          <Battery size={18} /> Battery Level
        </div>
        <div className="scooter-detail-battery-bar-track">
          <div
            className="scooter-detail-battery-bar-fill"
            style={{ width: `${battery}%`, background: batteryColor }}
          />
        </div>
        <div className="scooter-detail-battery-label" style={{ color: batteryColor }}>
          {battery}%
        </div>
      </div>

      {/* Price info */}
      <div className="scooter-detail-card">
        <div className="scooter-detail-card-title">
          <DollarSign size={18} /> Pricing
        </div>
        <div className="scooter-detail-price-grid">
          <div className="scooter-detail-price-item">
            <span className="scooter-detail-price-label">Unlock fee</span>
            <span className="scooter-detail-price-value">${unlockFee.toFixed(2)}</span>
          </div>
          <div className="scooter-detail-price-item">
            <span className="scooter-detail-price-label">Per minute</span>
            <span className="scooter-detail-price-value">${pricePerMin.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Cost estimator */}
      <div className="scooter-detail-card">
        <div className="scooter-detail-card-title">
          <Clock size={18} /> Estimate Your Ride
        </div>
        <div className="scooter-detail-estimator">
          <label>
            Ride duration: <strong>{estimatedMinutes} min</strong>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            className="scooter-detail-slider"
          />
          <div className="scooter-detail-slider-labels">
            <span>5 min</span>
            <span>60 min</span>
          </div>
          <div className="scooter-detail-estimate-total">
            Estimated total: <strong>${estimatedCost.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Unlock error */}
      {unlockError && (
        <div className="scooter-detail-unlock-error">
          <AlertCircle size={16} /> {unlockError}
        </div>
      )}

      {/* Action */}
      {activeRental ? (
        <div className="scooter-detail-active-notice">
          You already have an active ride.{' '}
          <Link to="/ride">View ride</Link>
        </div>
      ) : !isAvailable ? (
        <div className="scooter-detail-unavailable">
          <AlertCircle size={18} />
          This scooter is currently unavailable.
        </div>
      ) : (
        <button
          className="scooter-detail-unlock-btn"
          onClick={handleUnlock}
          disabled={unlocking}
        >
          {unlocking ? (
            <>
              <Loader size={20} className="scooter-detail-spinner" />
              Unlocking...
            </>
          ) : (
            <>
              <Zap size={20} />
              Unlock & Ride
            </>
          )}
        </button>
      )}
    </div>
  );
}
