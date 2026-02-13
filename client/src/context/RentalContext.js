import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const RentalContext = createContext(null);

const POLL_INTERVAL = 10000; // 10 seconds

export function RentalProvider({ children }) {
  const { user } = useAuth();
  const [activeRental, setActiveRental] = useState(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const checkActiveRental = useCallback(async () => {
    if (!user) {
      setActiveRental(null);
      return;
    }

    try {
      setLoading(true);
      const data = await api.rentals.active();
      setActiveRental(data.rental || data || null);
    } catch (err) {
      if (err.status === 404) {
        setActiveRental(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshRental = useCallback(async () => {
    if (!activeRental) return;

    try {
      const data = await api.rentals.active();
      setActiveRental(data.rental || data || null);
    } catch (err) {
      if (err.status === 404) {
        setActiveRental(null);
      }
    }
  }, [activeRental]);

  const startRental = useCallback(async (scooterId) => {
    const data = await api.rentals.start(scooterId);
    const rental = data.rental || data;
    // Enrich rental with scooter fields for immediate display
    // (GET /active returns these via JOIN, but POST /start returns scooter separately)
    if (data.scooter) {
      rental.scooter_code = data.scooter.code;
      rental.scooter_model = data.scooter.model;
      rental.scooter_battery = data.scooter.battery_level;
    }
    setActiveRental(rental);
    return data;
  }, []);

  const endRental = useCallback(async (id, lat, lng) => {
    const data = await api.rentals.end(id, { latitude: lat, longitude: lng });
    setActiveRental(null);
    return data;
  }, []);

  // Check for active rental when user logs in
  useEffect(() => {
    if (user) {
      checkActiveRental();
    } else {
      setActiveRental(null);
    }
  }, [user, checkActiveRental]);

  // Poll for updates when there's an active rental
  useEffect(() => {
    if (activeRental) {
      pollRef.current = setInterval(() => {
        refreshRental();
      }, POLL_INTERVAL);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeRental, refreshRental]);

  const value = {
    activeRental,
    loading,
    startRental,
    endRental,
    refreshRental,
    checkActiveRental,
  };

  return (
    <RentalContext.Provider value={value}>
      {children}
    </RentalContext.Provider>
  );
}

export function useRental() {
  const context = useContext(RentalContext);
  if (!context) {
    throw new Error('useRental must be used within a RentalProvider');
  }
  return context;
}
