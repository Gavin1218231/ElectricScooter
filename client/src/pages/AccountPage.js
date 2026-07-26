import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Edit3,
  Save,
  X,
  LogOut,
  Zap,
  DollarSign,
  MapPin,
  AlertCircle,
  Loader,
  Check,
  Info,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './AccountPage.css';

export default function AccountPage() {
  const { user, logout, updateUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* ---- Stats from ride history ---- */
  const [stats, setStats] = useState({ totalRides: 0, totalSpent: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const data = await api.rentals.history();
        const rides = data.rentals || data || [];
        if (!cancelled) {
          // Prefer server-side aggregates: history is paginated, so reducing the
          // returned page would under-count a user with more rides than one page.
          const totalRides = data.total ?? rides.length;
          const totalSpent = data.total_spent ?? rides.reduce((sum, r) => {
            const cost = r.total_cost ?? r.totalCost ?? r.cost ?? 0;
            return sum + Number(cost);
          }, 0);
          setStats({ totalRides, totalSpent: Number(totalSpent) });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  const handleEditToggle = () => {
    if (editing) {
      /* cancel edits */
      setName(user?.name || '');
      setPhone(user?.phone || '');
      setSaveError('');
    }
    setEditing(!editing);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await updateUser({ name, phone });
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-page">
      {/* Header */}
      <div className="ap-header">
        <h1>Account</h1>
      </div>

      {/* Profile card */}
      <div className="ap-profile-card">
        <div className="ap-avatar">
          <User size={36} />
        </div>

        {editing ? (
          <div className="ap-edit-form">
            <div className="ap-field">
              <label><User size={14} /> Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="ap-field">
              <label><Phone size={14} /> Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="ap-field ap-field-readonly">
              <label><Mail size={14} /> Email</label>
              <span>{user?.email || '—'}</span>
            </div>

            {saveError && (
              <div className="ap-save-error">
                <AlertCircle size={14} /> {saveError}
              </div>
            )}

            <div className="ap-edit-actions">
              <button className="ap-cancel-btn" onClick={handleEditToggle}>
                <X size={16} /> Cancel
              </button>
              <button className="ap-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><Loader size={16} className="ap-spinner" /> Saving...</>
                ) : (
                  <><Save size={16} /> Save</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="ap-profile-info">
            <div className="ap-info-row">
              <User size={16} />
              <span>{user?.name || '—'}</span>
            </div>
            <div className="ap-info-row">
              <Mail size={16} />
              <span>{user?.email || '—'}</span>
            </div>
            <div className="ap-info-row">
              <Phone size={16} />
              <span>{user?.phone || '—'}</span>
            </div>

            <button className="ap-edit-btn" onClick={handleEditToggle}>
              <Edit3 size={16} /> Edit Profile
            </button>

            {saveSuccess && (
              <div className="ap-save-success">
                <Check size={14} /> Profile updated!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="ap-stats-card">
        <h2 className="ap-stats-title">Your Stats</h2>
        {statsLoading ? (
          <div className="ap-stats-loading">
            <Loader size={20} className="ap-spinner" />
          </div>
        ) : (
          <div className="ap-stats-grid">
            <div className="ap-stat">
              <MapPin size={20} color="var(--primary)" />
              <span className="ap-stat-value">{stats.totalRides}</span>
              <span className="ap-stat-label">Total Rides</span>
            </div>
            <div className="ap-stat">
              <DollarSign size={20} color="var(--primary)" />
              <span className="ap-stat-value">${stats.totalSpent.toFixed(2)}</span>
              <span className="ap-stat-label">Total Spent</span>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button className="ap-logout-btn" onClick={logout}>
        <LogOut size={18} />
        Sign Out
      </button>

      {/* App info */}
      <div className="ap-app-info">
        <Zap size={16} color="var(--text-secondary)" />
        <span>Vim Scooters v1.0</span>
      </div>
    </div>
  );
}
