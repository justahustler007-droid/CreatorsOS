import { useEffect } from 'react';
import axios from 'axios';
import { FireballLogo } from '../components/FireballLogo';
import { useAuth } from '../context/AuthContext';

const API = 'https://creatorsos-1.onrender.com/api';

const AuthCallback = () => {
  const { setUserData } = useAuth();

  useEffect(() => {
    const processAuth = async () => {
      const hash = window.location.hash;

      console.log('AUTH CALLBACK HASH:', hash);

      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error('No session_id found');
        window.location.href = '/';
        return;
      }

      console.log('Session ID found');
      console.log('Sending session to:', `${API}/auth/session`);

      try {
        const response = await axios.post(
          `${API}/auth/session`,
          {
            session_id: sessionId,
          },
          {
            timeout: 15000,
            withCredentials: true,
          }
        );

        console.log('AUTH SUCCESS:', response.data);

        const { session_token, ...userData } = response.data;

        if (!session_token) {
          throw new Error('No session token returned by backend');
        }

        setUserData(userData, session_token);

        localStorage.setItem(
          'creatoros_session_token',
          session_token
        );

        window.history.replaceState(
          {},
          document.title,
          '/dashboard'
        );

        window.location.href = '/dashboard';

      } catch (error) {
        console.error('AUTH FAILED:', error);

        if (error.response) {
          console.error(
            'STATUS:',
            error.response.status
          );
          console.error(
            'DATA:',
            error.response.data
          );
        }

        alert(
          'Login failed: ' +
          (error.response?.data?.detail || error.message)
        );

        window.location.href = '/';
      }
    };

    processAuth();
  }, [setUserData]);

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
