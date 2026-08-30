import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = 'https://creatorsos-1.onrender.com/api';
const TOKEN_KEY = 'creatoros_session_token';

const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
  }
};

const initialToken =
  typeof window !== 'undefined'
    ? localStorage.getItem(TOKEN_KEY)
    : null;

if (initialToken) {
  axios.defaults.headers.common['Authorization'] =
    `Bearer ${initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true,
        timeout: 10000,
      });

      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);

      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Do not call /auth/me while OAuth is returning.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    checkAuth();
  }, [checkAuth]);

  const login = () => {
    const redirectUrl =
      window.location.origin + '/dashboard';

    window.location.href =
      `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
        redirectUrl
      )}`;
  };

  const logout = async () => {
    try {
      await axios.post(
        `${API}/auth/logout`,
        {},
        {
          withCredentials: true,
          timeout: 10000,
        }
      );
    } catch (error) {
      console.error('Logout error:', error);
    }

    setAuthToken(null);
    setUser(null);

    localStorage.removeItem('creatoros_profile');
    localStorage.removeItem('creatoros_onboarding_complete');

    window.location.href = '/';
  };

  const setUserData = (userData, token) => {
    if (token) {
      setAuthToken(token);
    }

    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        setUserData,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};
