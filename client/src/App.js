import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Map, Clock, User, Wallet, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RentalProvider, useRental } from './context/RentalContext';
import './App.css';

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------
import MapView from './pages/MapView';
import ScooterDetail from './pages/ScooterDetail';
import ActiveRide from './pages/ActiveRide';
import RideHistory from './pages/RideHistory';
import WalletPage from './pages/WalletPage';
import AccountPage from './pages/AccountPage';

// ---------------------------------------------------------------------------
// Auth pages (kept inline)
// ---------------------------------------------------------------------------

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Zap size={48} color="var(--primary)" />
          <h1>Vim Scooters</h1>
        </div>
        <h2>Welcome Back</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">
          Don't have an account? <NavLink to="/register">Sign up</NavLink>
        </p>
      </div>
    </div>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password, name, phone);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Zap size={48} color="var(--primary)" />
          <h1>Vim Scooters</h1>
        </div>
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <NavLink to="/login">Sign in</NavLink>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protected Route wrapper
// ---------------------------------------------------------------------------

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <Zap size={48} color="var(--primary)" className="loading-icon" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ---------------------------------------------------------------------------
// Bottom Navigation
// ---------------------------------------------------------------------------

function BottomNav() {
  const { activeRental } = useRental();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <Map size={22} />
        <span>Map</span>
      </NavLink>
      {activeRental && (
        <NavLink to="/ride" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Zap size={22} />
          <span>Ride</span>
        </NavLink>
      )}
      <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Clock size={22} />
        <span>History</span>
      </NavLink>
      <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Wallet size={22} />
        <span>Wallet</span>
      </NavLink>
      <NavLink to="/account" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <User size={22} />
        <span>Account</span>
      </NavLink>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// App Layout (authenticated pages with bottom nav)
// ---------------------------------------------------------------------------

function AuthenticatedLayout({ children }) {
  return (
    <div className="app-layout">
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Router
// ---------------------------------------------------------------------------

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (loading) {
    return (
      <div className="loading-screen">
        <Zap size={48} color="var(--primary)" className="loading-icon" />
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <MapView />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scooter/:id"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <ScooterDetail />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ride"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <ActiveRide />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <RideHistory />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <AccountPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <WalletPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ---------------------------------------------------------------------------
// Root App component
// ---------------------------------------------------------------------------

function App() {
  return (
    <AuthProvider>
      <RentalProvider>
        <AppRoutes />
      </RentalProvider>
    </AuthProvider>
  );
}

export default App;
