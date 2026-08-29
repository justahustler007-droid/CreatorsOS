/**
 * Shared notification state for the entire app.
 *
 * Why this exists: the sidebar bell, the /notifications page, and any module
 * that mutates data which produces a notification (Brand Finder outreach
 * status, Network collab actions) ALL need to see the same `items` and
 * `unread` count without waiting for the 45s background poll. This context
 * holds the canonical state and exposes optimistic mutators.
 *
 * Use:
 *   const { items, unread, markRead, dismiss, refresh } = useNotifications();
 *
 * After any side-effecting action elsewhere in the app (e.g. moving an
 * outreach card to "Replied" which creates a notification on the backend),
 * call `refresh()` to pull the new state in.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 45_000;

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState({ total: 0, by_category: {} });
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  // ── Pull from server (deduped, no overlap) ──────────────────────────
  const refresh = useCallback(async (opts = {}) => {
    if (!user) return;
    if (inFlight.current) return;
    inFlight.current = true;
    if (opts.silent !== true) setLoading(true);
    try {
      const params = { limit: 100 };
      if (opts.category) params.category = opts.category;
      if (opts.unreadOnly) params.unread_only = true;
      const [list, count] = await Promise.all([
        axios.get(`${API}/notifications`, { params, withCredentials: true }),
        axios.get(`${API}/notifications/unread-count`, { withCredentials: true }),
      ]);
      setItems(list.data);
      setUnread(count.data);
    } catch {
      /* silent — banner not worth showing for background poll */
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user]);

  // ── Optimistic mutators ────────────────────────────────────────────
  const markRead = useCallback(async (notificationId) => {
    const target = items.find((n) => n.notification_id === notificationId);
    if (!target || target.read) return;
    setItems((arr) => arr.map((n) => n.notification_id === notificationId ? { ...n, read: true } : n));
    setUnread((u) => ({
      ...u,
      total: Math.max(0, u.total - 1),
      by_category: {
        ...u.by_category,
        [target.category]: Math.max(0, (u.by_category[target.category] || 1) - 1),
      },
    }));
    try {
      await axios.post(`${API}/notifications/${notificationId}/read`, {}, { withCredentials: true });
    } catch {
      refresh({ silent: true });   // rollback by refetching truth
    }
  }, [items, refresh]);

  const markAllRead = useCallback(async (category = null) => {
    setItems((arr) => arr.map((n) =>
      (!category || n.category === category) ? { ...n, read: true } : n
    ));
    if (category) {
      setUnread((u) => ({
        ...u,
        total: Math.max(0, u.total - (u.by_category[category] || 0)),
        by_category: { ...u.by_category, [category]: 0 },
      }));
    } else {
      setUnread({ total: 0, by_category: {} });
    }
    try {
      await axios.post(`${API}/notifications/read-all`, null, {
        params: category ? { category } : {},
        withCredentials: true,
      });
    } catch {
      refresh({ silent: true });
    }
  }, [refresh]);

  const dismiss = useCallback(async (notificationId) => {
    const target = items.find((n) => n.notification_id === notificationId);
    if (!target) return;
    setItems((arr) => arr.filter((n) => n.notification_id !== notificationId));
    if (!target.read) {
      setUnread((u) => ({
        ...u,
        total: Math.max(0, u.total - 1),
        by_category: {
          ...u.by_category,
          [target.category]: Math.max(0, (u.by_category[target.category] || 1) - 1),
        },
      }));
    }
    try {
      await axios.delete(`${API}/notifications/${notificationId}`, { withCredentials: true });
    } catch {
      refresh({ silent: true });
    }
  }, [items, refresh]);

  const clearRead = useCallback(async () => {
    setItems((arr) => arr.filter((n) => !n.read));   // optimistic strip
    try {
      await axios.delete(`${API}/notifications`, {
        params: { only_read: true },
        withCredentials: true,
      });
    } catch {
      refresh({ silent: true });
    }
  }, [refresh]);

  const triggerDigest = useCallback(async () => {
    const res = await axios.post(`${API}/notifications/digest/weekly`, {}, { withCredentials: true });
    if (res.data.created) await refresh({ silent: true });
    return res.data;
  }, [refresh]);

  // ── Initial load + polling + focus refresh ─────────────────────────
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread({ total: 0, by_category: {} });
      return undefined;
    }
    refresh();
    const id = setInterval(() => refresh({ silent: true }), POLL_MS);
    const onFocus = () => refresh({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refresh]);

  const value = {
    items,
    unread,
    loading,
    refresh,
    markRead,
    markAllRead,
    dismiss,
    clearRead,
    triggerDigest,
  };
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Outside provider (e.g. landing page) — return harmless no-ops so
    // callers can stay simple.
    return {
      items: [], unread: { total: 0, by_category: {} }, loading: false,
      refresh: () => {}, markRead: () => {}, markAllRead: () => {},
      dismiss: () => {}, clearRead: () => {}, triggerDigest: async () => ({ created: false }),
    };
  }
  return ctx;
};
