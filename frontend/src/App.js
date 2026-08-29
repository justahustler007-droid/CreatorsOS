import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from './components/ui/sonner';
import axios from 'axios';

// Pages
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import Paywall from './pages/Paywall';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Deals from './pages/Deals';
import Analytics from './pages/Analytics';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import BrandFinder from './pages/BrandFinder';
import Network from './pages/Network';
import Notifications from './pages/Notifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Protected Route Component with Paywall & Onboarding
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [accessStatus, setAccessStatus] = useState(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setCheckingAccess(false);
        return;
      }

      // ── 100% frontend-driven gating (MVP). No /api/profile / /api/auth/access-status
      // ── round-trips required. Backend can be offline and the app still works.
      const localGrant = localStorage.getItem('creatoros_early_access') === 'true';
      const localOnboardingDone = localStorage.getItem('creatoros_onboarding_complete') === 'true';

      // Best-effort sync with the backend (does NOT block — failure is fine).
      let serverState = { early_access: false, onboarding_complete: false };
      try {
        const response = await axios.get(`${API}/auth/access-status`, {
          withCredentials: true,
          timeout: 3000,
        });
        serverState = response.data || serverState;
      } catch (_) { /* offline or 4xx — local state wins */ }

      setAccessStatus({
        early_access: serverState.early_access || localGrant,
        onboarding_complete: serverState.onboarding_complete || localOnboardingDone,
      });
      setCheckingAccess(false);
    };

    if (!loading) {
      checkAccess();
    }
  }, [user, loading]);

  // If user data was passed from AuthCallback, skip loading check
  if (location.state?.user && !accessStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check if user has early access
  if (accessStatus && !accessStatus.early_access) {
    return <Paywall onAccessGranted={() => setAccessStatus({ ...accessStatus, early_access: true })} />;
  }

  // Check if onboarding is complete
  if (accessStatus && !accessStatus.onboarding_complete) {
    return <Onboarding user={user} onComplete={() => setAccessStatus({ ...accessStatus, onboarding_complete: true })} />;
  }

  return children;
};

// App Router - handles session_id detection synchronously
const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment for session_id SYNCHRONOUSLY during render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/income"
        element={
          <ProtectedRoute>
            <Income />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deals"
        element={
          <ProtectedRoute>
            <Deals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand-finder"
        element={
          <ProtectedRoute>
            <BrandFinder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/network"
        element={
          <ProtectedRoute>
            <Network />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
