import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FireballLogo } from '../components/FireballLogo';
import { useAuth } from '../context/AuthContext';

const API = 'https://creatorsos-1.onrender.com/api';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const { setUserData } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;

      const match = hash.match(/session_id=([^&]+)/);

      if (!match) {
        console.error('No session_id found');
        navigate('/', { replace: true });
        return;
      }

      const sessionId = decodeURIComponent(match[1]);

      console.log('Session ID found');
      console.log('Backend:', API);

      try {
        const response = await axios.post(
          `${API}/auth/session`,
          {
            session_id: sessionId,
          },
          {
            withCredentials: true,
            timeout: 15000,
          }
        );

        console.log('Authentication successful');

        const { session_token, ...userData } = response.data;

        if (!session_token) {
          throw new Error('Backend did not return session_token');
        }

        setUserData(userData, session_token);

        window.history.replaceState(
          {},
          document.title,
          '/dashboard'
        );

        navigate('/dashboard', {
          replace: true,
        });

      } catch (error) {
        console.error('AUTH ERROR:', error);

        if (error.response) {
          console.error(
            'Backend response:',
            error.response.status,
            error.response.data
          );
        } else if (error.request) {
          console.error('Backend did not respond');
        } else {
          console.error('Request error:', error.message);
        }

        alert(
          'Login failed. Please try again. Check the browser console for the exact error.'
        );

        navigate('/', { replace: true });
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
