import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FireballLogo } from '../components/FireballLogo';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const { setUserData } = useAuth();

  useEffect(() => {
    // Use useRef to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.error('No session_id found in URL');
        navigate('/');
        return;
      }

      const sessionId = sessionIdMatch[1];

      try {
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        // Backend returns user + session_token in body. We persist both:
        // - cookie (set by backend) — primary for same-domain
        // - localStorage + Authorization header — fallback for cross-domain
        //   (Netlify ↔ Render) and 3rd-party-cookie blocking browsers.
        const { session_token, ...userData } = response.data;
        setUserData(userData, session_token);

        // Clean up URL and navigate
        window.history.replaceState({}, document.title, '/dashboard');
        navigate('/dashboard', { state: { user: userData }, replace: true });
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/');
      }
    };

    processAuth();
  }, [navigate, setUserData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <FireballLogo size="lg" animate />
        </div>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Signing you in...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
