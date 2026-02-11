import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Search,
  RefreshCw,
  Crosshair,
  Zap,
  Battery,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import api from '../api';
import { useRental } from '../context/RentalContext';
import './MapView.css';

/* ------------------------------------------------------------------ */
/*  Helper: fly the map to a given position                           */
/* ------------------------------------------------------------------ */
function FlyToLocation({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 1.2 });
    }
  }, [position, map]);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Leaflet DivIcons                                                  */
/* ------------------------------------------------------------------ */
function scooterIcon(battery) {
  const color = battery < 30 ? '#FF9800' : '#00C853';
  return L.divIcon({
    className: 'scooter-marker-wrapper',
    html: `
      <div class="scooter-marker" style="background:${color}">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
             viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7.5" cy="20.5" r="2.5"/>
          <circle cx="18.5" cy="20.5" r="2.5"/>
          <path d="M13 5l-1.5 8H5l3-8h5z"/>
          <path d="M13 5h3l2 8h-3"/>
          <path d="M7.5 18V8"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

const userIcon = L.divIcon({
  className: 'user-marker-wrapper',
  html: '<div class="user-marker"><div class="user-marker-pulse"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/* ------------------------------------------------------------------ */
/*  Default centre – Southwest Florida                                */
/* ------------------------------------------------------------------ */
const DEFAULT_CENTER = [26.49, -81.87];

/* ------------------------------------------------------------------ */
/*  MapView Component                                                 */
/* ------------------------------------------------------------------ */
export default function MapView() {
  const navigate = useNavigate();
  const { activeRental } = useRental();

  const [userPos, setUserPos] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const initialLoadDone = useRef(false);

  /* ---- Geolocation ---- */
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        if (!initialLoadDone.current) {
          setFlyTarget(coords);
          initialLoadDone.current = true;
        }
      },
      () => {
        /* silently fall back to default */
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  /* ---- Fetch scooters ---- */
  const fetchScooters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (userPos) {
        params.lat = userPos[0];
        params.lng = userPos[1];
      }
      const data = await api.scooters.list(params);
      setScooters(data.scooters || data || []);
    } catch (err) {
      setError('Failed to load scooters. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [userPos]);

  useEffect(() => {
    fetchScooters();
  }, [fetchScooters]);

  /* ---- Search by code ---- */
  const handleSearch = async (e) => {
    e.preventDefault();
    const code = searchCode.trim().toUpperCase();
    if (!code) return;
    setSearchError('');
    setSearching(true);
    try {
      const data = await api.scooters.getByCode(code);
      const scooter = data.scooter || data;
      if (scooter && (scooter.id || scooter._id)) {
        navigate(`/scooter/${scooter.id || scooter._id}`);
      } else {
        setSearchError('Scooter not found');
      }
    } catch {
      setSearchError('Scooter not found');
    } finally {
      setSearching(false);
    }
  };

  /* ---- Re-centre ---- */
  const handleRecenter = () => {
    if (userPos) {
      setFlyTarget([...userPos]);
    } else {
      getLocation();
    }
  };

  /* ---- Refresh ---- */
  const handleRefresh = () => {
    getLocation();
    fetchScooters();
  };

  const mapCenter = userPos || DEFAULT_CENTER;

  return (
    <div className="mapview">
      {/* Active ride banner */}
      {activeRental && (
        <Link to="/ride" className="mapview-ride-banner">
          <Zap size={18} />
          <span>Ride in progress — tap to view</span>
        </Link>
      )}

      {/* Search bar */}
      <div className="mapview-search">
        <form onSubmit={handleSearch} className="mapview-search-form">
          <Search size={18} className="mapview-search-icon" />
          <input
            type="text"
            placeholder='Enter scooter code (e.g. "VIM-0001")'
            value={searchCode}
            onChange={(e) => {
              setSearchCode(e.target.value);
              setSearchError('');
            }}
          />
          <button type="submit" disabled={searching}>
            {searching ? '...' : 'Go'}
          </button>
        </form>
        {searchError && (
          <div className="mapview-search-error">
            <AlertCircle size={14} /> {searchError}
          </div>
        )}
      </div>

      {/* Scooter count */}
      <div className="mapview-count">
        {loading ? 'Searching...' : `${scooters.length} scooter${scooters.length !== 1 ? 's' : ''} nearby`}
      </div>

      {/* Error */}
      {error && <div className="mapview-error">{error}</div>}

      {/* Map */}
      <div className="mapview-map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={15}
          className="mapview-map"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {flyTarget && <FlyToLocation position={flyTarget} />}

          {/* User location */}
          {userPos && <Marker position={userPos} icon={userIcon} />}

          {/* Scooters */}
          {scooters.map((s) => {
            const lat = s.latitude ?? s.lat;
            const lng = s.longitude ?? s.lng;
            if (lat == null || lng == null) return null;
            return (
              <Marker
                key={s.id || s._id}
                position={[lat, lng]}
                icon={scooterIcon(s.battery_level ?? s.batteryLevel ?? 100)}
              >
                <Popup className="mapview-popup">
                  <div className="mapview-popup-content">
                    <div className="mapview-popup-header">
                      <Zap size={16} />
                      <strong>{s.code || s.scooterCode}</strong>
                    </div>
                    <p className="mapview-popup-model">{s.model || 'Vim Scooter'}</p>
                    <div className="mapview-popup-stats">
                      <span className="mapview-popup-battery">
                        <Battery size={14} />
                        {s.battery_level ?? s.batteryLevel ?? '—'}%
                      </span>
                      <span className="mapview-popup-price">
                        <DollarSign size={14} />
                        {s.price_per_minute ?? s.pricePerMinute ?? '0.25'}/min
                      </span>
                    </div>
                    <Link
                      to={`/scooter/${s.id || s._id}`}
                      className="mapview-popup-btn"
                    >
                      Rent This Scooter
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating controls */}
        <div className="mapview-controls">
          <button
            className="mapview-control-btn"
            onClick={handleRecenter}
            title="Re-center on my location"
          >
            <Crosshair size={20} />
          </button>
          <button
            className="mapview-control-btn"
            onClick={handleRefresh}
            title="Refresh scooters"
          >
            <RefreshCw size={20} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
