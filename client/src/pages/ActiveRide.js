import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import {
  Zap,
  Battery,
  Clock,
  DollarSign,
  MapPin,
  StopCircle,
  CheckCircle,
  AlertCircle,
  Loader,
  X,
} from 'lucide-react';
import { useRental } from '../context/RentalContext';
import './ActiveRide.css';

/* ---- Start-location marker ---- */
const startIcon = L.divIcon({
  className: 'ride-start-marker-wrapper',
  html: '<div class="ride-start-marker"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/* ---- Helpers ---- */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function ActiveRide() {
  const navigate = useNavigate();
  const { activeRental, endRental } = useRental();

  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState(null);
  const timerRef = useRef(null);

  /* ---- Live timer ---- */
  useEffect(() => {
    if (!activeRental) return;

    const startTime = new Date(activeRental.start_time || activeRental.startTime || activeRental.createdAt).getTime();

    const tick = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRental]);

  /* ---- Derived values ---- */
  const unlockFee = activeRental?.unlock_fee ?? activeRental?.unlockFee ?? 1.0;
  const pricePerMin = activeRental?.per_minute_cost ?? activeRental?.price_per_minute ?? activeRental?.pricePerMinute ?? 0.25;
  const elapsedMinutes = elapsed / 60;
  const runningCost = unlockFee + elapsedMinutes * pricePerMin;
  const battery = activeRental?.scooter_battery ?? activeRental?.scooter?.battery_level ?? activeRental?.battery_level ?? '—';

  const startLat =
    activeRental?.start_latitude ??
    activeRental?.startLat ??
    26.49;
  const startLng =
    activeRental?.start_longitude ??
    activeRental?.startLng ??
    -81.87;

  const scooterCode =
    activeRental?.scooter_code ||
    activeRental?.scooter?.code ||
    activeRental?.scooterCode ||
    'VIM-XXXX';
  const scooterModel =
    activeRental?.scooter_model ||
    activeRental?.scooter?.model || activeRental?.scooterModel || 'Vim Scooter';

  /* ---- End ride ---- */
  const handleEndRide = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    setEndError('');

    const finish = async (lat, lng) => {
      try {
        const result = await endRental(activeRental.id || activeRental._id, lat, lng);
        const rental = result?.rental || result;
        const sum = result?.summary || {};
        setSummary({
          duration: sum.duration_minutes ?? rental?.duration_minutes ?? Math.round(elapsed / 60),
          distance: sum.distance_km ?? rental?.distance_km ?? 0,
          unlockFee: sum.unlock_fee ?? rental?.unlock_fee ?? unlockFee,
          rideCost: sum.per_minute_cost ?? rental?.per_minute_cost ?? (elapsedMinutes * pricePerMin),
          total: sum.total_cost ?? rental?.total_cost ?? runningCost,
        });
      } catch (err) {
        setEndError(err.message || 'Failed to end ride');
      } finally {
        setEnding(false);
        setShowConfirm(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords.latitude, pos.coords.longitude),
        () => finish(startLat, startLng),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      await finish(startLat, startLng);
    }
  }, [ending, activeRental, endRental, elapsed, elapsedMinutes, pricePerMin, unlockFee, runningCost, startLat, startLng]);

  /* ---- No active ride ---- */
  if (!activeRental && !summary) {
    return (
      <div className="active-ride">
        <div className="active-ride-empty">
          <Zap size={56} color="var(--text-secondary)" />
          <h2>No Active Ride</h2>
          <p>Find a scooter on the map to start riding.</p>
          <Link to="/" className="active-ride-map-link">Go to Map</Link>
        </div>
      </div>
    );
  }

  /* ---- Ride summary ---- */
  if (summary) {
    return (
      <div className="active-ride">
        <div className="active-ride-summary">
          <div className="active-ride-summary-icon">
            <CheckCircle size={56} color="var(--primary)" />
          </div>
          <h2>Ride Complete!</h2>

          <div className="active-ride-summary-grid">
            <div className="active-ride-summary-item">
              <Clock size={18} />
              <span className="active-ride-summary-label">Duration</span>
              <span className="active-ride-summary-value">
                {summary.duration} min
              </span>
            </div>
            <div className="active-ride-summary-item">
              <MapPin size={18} />
              <span className="active-ride-summary-label">Distance</span>
              <span className="active-ride-summary-value">
                {typeof summary.distance === 'number'
                  ? `${summary.distance.toFixed(1)} km`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="active-ride-summary-cost">
            <div className="active-ride-summary-cost-row">
              <span>Unlock fee</span>
              <span>${Number(summary.unlockFee).toFixed(2)}</span>
            </div>
            <div className="active-ride-summary-cost-row">
              <span>Ride cost</span>
              <span>${Number(summary.rideCost).toFixed(2)}</span>
            </div>
            <div className="active-ride-summary-cost-row active-ride-summary-cost-total">
              <span>Total</span>
              <span>${Number(summary.total).toFixed(2)}</span>
            </div>
          </div>

          <button className="active-ride-done-btn" onClick={() => navigate('/')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  /* ---- Active ride dashboard ---- */
  return (
    <div className="active-ride">
      {/* Pulsing indicator */}
      <div className="active-ride-status-bar">
        <span className="active-ride-pulse-dot" />
        Ride in Progress
      </div>

      {/* Scooter info */}
      <div className="active-ride-scooter-info">
        <Zap size={22} color="var(--primary)" />
        <div>
          <strong>{scooterCode}</strong>
          <span>{scooterModel}</span>
        </div>
      </div>

      {/* Big stats */}
      <div className="active-ride-stats">
        <div className="active-ride-stat active-ride-stat-time">
          <Clock size={20} />
          <span className="active-ride-stat-label">Time</span>
          <span className="active-ride-stat-value">{formatDuration(elapsed)}</span>
        </div>
        <div className="active-ride-stat active-ride-stat-cost">
          <DollarSign size={20} />
          <span className="active-ride-stat-label">Cost</span>
          <span className="active-ride-stat-value">${runningCost.toFixed(2)}</span>
        </div>
      </div>

      {/* Battery */}
      <div className="active-ride-battery">
        <Battery size={16} />
        <span>Battery: {battery}%</span>
      </div>

      {/* Mini map */}
      <div className="active-ride-minimap">
        <MapContainer
          center={[startLat, startLng]}
          zoom={16}
          className="active-ride-map"
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[startLat, startLng]} icon={startIcon} />
        </MapContainer>
        <div className="active-ride-minimap-label">
          <MapPin size={14} /> Ride start location
        </div>
      </div>

      {/* End ride error */}
      {endError && (
        <div className="active-ride-error">
          <AlertCircle size={16} /> {endError}
        </div>
      )}

      {/* End ride button */}
      <button
        className="active-ride-end-btn"
        onClick={() => setShowConfirm(true)}
      >
        <StopCircle size={22} />
        End Ride
      </button>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="active-ride-confirm-overlay">
          <div className="active-ride-confirm-card">
            <button
              className="active-ride-confirm-close"
              onClick={() => setShowConfirm(false)}
            >
              <X size={20} />
            </button>
            <h3>End this ride?</h3>
            <p>
              Current cost: <strong>${runningCost.toFixed(2)}</strong>
            </p>
            <div className="active-ride-confirm-actions">
              <button
                className="active-ride-confirm-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Keep Riding
              </button>
              <button
                className="active-ride-confirm-end"
                onClick={handleEndRide}
                disabled={ending}
              >
                {ending ? (
                  <>
                    <Loader size={16} className="active-ride-spinner" /> Ending...
                  </>
                ) : (
                  'End Ride'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
