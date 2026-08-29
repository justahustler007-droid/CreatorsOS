import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = 'creatoros_session_token';

// ─── Persist auth across browsers that block 3rd-party cookies (Safari ITP,
// ─── Brave, etc.). Backend `deps.get_current_user` already accepts EITHER
// ─── cookie OR Authorization Bearer header, so the same session works.
const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
  }
};

// Restore token on initial JS load so every axios call (including the very
// first /auth/me) carries it.
const _initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
if (_initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${_initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      // 401 → invalid/expired token. Clear localStorage too so we don't keep
      // sending a dead Bearer header on next reload.
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Clear all client-side state — no orphaned profiles from a previous user.
    setAuthToken(null);
    setUser(null);
    try {
      localStorage.removeItem('creatoros_profile');
      localStorage.removeItem('creatoros_onboarding_complete');
    } catch (_) { /* ignore */ }
    window.location.href = '/';
  };

  const setUserData = (userData, token = null) => {
    if (token) setAuthToken(token);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUserData, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
