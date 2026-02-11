import React, { useState, useEffect } from 'react';
import {
  Clock,
  Zap,
  MapPin,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader,
} from 'lucide-react';
import api from '../api';
import './RideHistory.css';

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

function statusLabel(status) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'active': return 'Active';
    default: return status || 'Completed';
  }
}

function statusClass(status) {
  switch (status) {
    case 'completed': return 'rh-status-completed';
    case 'cancelled': return 'rh-status-cancelled';
    case 'active': return 'rh-status-active';
    default: return 'rh-status-completed';
  }
}

export default function RideHistory() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.rentals.history();
        if (!cancelled) {
          setRides(data.rentals || data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load ride history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, []);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="ride-history">
        <div className="rh-header">
          <h1>Ride History</h1>
        </div>
        <div className="rh-loading">
          <Loader size={32} className="rh-spinner" />
          <p>Loading your rides...</p>
        </div>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error) {
    return (
      <div className="ride-history">
        <div className="rh-header">
          <h1>Ride History</h1>
        </div>
        <div className="rh-error-state">
          <AlertCircle size={40} color="var(--error)" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ride-history">
      <div className="rh-header">
        <h1>Ride History</h1>
        {rides.length > 0 && (
          <span className="rh-count">{rides.length} ride{rides.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Empty state */}
      {rides.length === 0 && (
        <div className="rh-empty">
          <div className="rh-empty-icon">
            <Clock size={56} color="var(--border-color)" />
          </div>
          <h2>No Rides Yet</h2>
          <p>Your ride history will appear here after your first trip.</p>
        </div>
      )}

      {/* Ride list */}
      <div className="rh-list">
        {rides.map((ride) => {
          const id = ride._id || ride.id;
          const isExpanded = expandedId === id;
          const code =
            ride.scooter_code || ride.scooter?.code || ride.scooterCode || 'VIM-XXXX';
          const duration = ride.duration_minutes ?? ride.duration ?? '—';
          const distance = ride.distance_km ?? ride.distance;
          const cost = ride.total_cost ?? ride.totalCost ?? ride.cost ?? 0;
          const status = ride.status || 'completed';
          const date = ride.start_time || ride.startTime || ride.createdAt;

          return (
            <div
              key={id}
              className={`rh-card ${isExpanded ? 'rh-card-expanded' : ''}`}
            >
              <button className="rh-card-header" onClick={() => toggleExpand(id)}>
                <div className="rh-card-left">
                  <div className="rh-card-icon">
                    <Zap size={18} />
                  </div>
                  <div className="rh-card-info">
                    <strong>{code}</strong>
                    <span>{date ? `${formatDate(date)} at ${formatTime(date)}` : '—'}</span>
                  </div>
                </div>
                <div className="rh-card-right">
                  <span className="rh-card-cost">${Number(cost).toFixed(2)}</span>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isExpanded && (
                <div className="rh-card-details">
                  <div className="rh-detail-row">
                    <Clock size={14} />
                    <span>Duration</span>
                    <strong>{duration} min</strong>
                  </div>
                  <div className="rh-detail-row">
                    <MapPin size={14} />
                    <span>Distance</span>
                    <strong>
                      {distance != null ? `${Number(distance).toFixed(1)} km` : '—'}
                    </strong>
                  </div>
                  <div className="rh-detail-row">
                    <DollarSign size={14} />
                    <span>Total Cost</span>
                    <strong>${Number(cost).toFixed(2)}</strong>
                  </div>
                  <div className="rh-detail-row">
                    <span
                      className={`rh-status-badge ${statusClass(status)}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
