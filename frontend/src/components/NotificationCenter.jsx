import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, CheckCheck, X, Inbox, Sparkles, TrendingUp, Activity,
  Users, Send, Trophy, Wand2, ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useNotifications } from '../context/NotificationContext';

const ICON_BY_TYPE = {
  collab_request_received:  Users,
  collab_request_accepted:  Check,
  collab_request_rejected:  X,
  collab_request_cancelled: X,
  outreach_viewed:          Activity,
  outreach_replied:         Send,
  outreach_negotiating:     Wand2,
  outreach_won:             Trophy,
  outreach_lost:            X,
  weekly_digest:            TrendingUp,
  milestone:                Sparkles,
  system:                   Bell,
};

const ACCENT_BY_TYPE = {
  collab_request_received:  'text-violet-500 bg-violet-500/10',
  collab_request_accepted:  'text-emerald-500 bg-emerald-500/10',
  collab_request_rejected:  'text-rose-500 bg-rose-500/10',
  collab_request_cancelled: 'text-slate-500 bg-slate-500/10',
  outreach_viewed:          'text-cyan-500 bg-cyan-500/10',
  outreach_replied:         'text-blue-500 bg-blue-500/10',
  outreach_negotiating:     'text-amber-500 bg-amber-500/10',
  outreach_won:             'text-emerald-500 bg-emerald-500/10',
  outreach_lost:            'text-rose-500 bg-rose-500/10',
  weekly_digest:            'text-indigo-500 bg-indigo-500/10',
  milestone:                'text-amber-500 bg-amber-500/10',
  system:                   'text-slate-500 bg-slate-500/10',
};

const PRIORITY_DOT = {
  high:   'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
  normal: 'bg-blue-500',
  low:    'bg-slate-400',
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

// ─── Notification row (shared between dropdown + page) ───────────────────
export const NotificationRow = ({ n, onAct, onClick, dense = false }) => {
  const Icon = ICON_BY_TYPE[n.type] || Bell;
  const accent = ACCENT_BY_TYPE[n.type] || ACCENT_BY_TYPE.system;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      onClick={() => onClick(n)}
      data-testid={`notification-${n.notification_id}`}
      className={`group relative flex gap-3 px-3.5 ${dense ? 'py-2.5' : 'py-3'} cursor-pointer
        ${n.read
          ? 'bg-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          : 'bg-gradient-to-r from-blue-500/[0.04] to-transparent hover:from-blue-500/[0.07]'}
        transition-colors border-b border-slate-100 dark:border-slate-800/60 last:border-b-0`}
    >
      {!n.read && (
        <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[n.priority] || PRIORITY_DOT.normal}`} aria-hidden />
      )}
      <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-manrope text-[13.5px] leading-snug ${n.read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white'}`}>
            {n.title}
          </p>
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{timeAgo(n.created_at)}</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>
        {n.action_label && (
          <div className="flex items-center gap-1 mt-1.5 text-[11.5px] font-medium text-indigo-500 group-hover:translate-x-0.5 transition-transform">
            {n.action_label} <ChevronRight className="h-3 w-3" />
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAct(n, 'dismiss'); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 shrink-0"
        aria-label="Dismiss"
        data-testid={`dismiss-${n.notification_id}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
};

// ─── Notification dropdown (sidebar bell) ────────────────────────────────
export const NotificationCenter = ({ collapsed = false }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { items, unread, loading, markRead, markAllRead, dismiss } = useNotifications();
  const recent = items.slice(0, 25);

  // ── Click-outside (excluding the button itself) ────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n) => {
    if (!n.read) await markRead(n.notification_id);
    if (n.action_url) {
      setOpen(false);
      navigate(n.action_url);
    }
  };

  const handleAct = async (n, action) => {
    if (action === 'dismiss') {
      try { await dismiss(n.notification_id); }
      catch { toast.error('Could not dismiss'); }
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    toast.success('All caught up');
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        data-testid="notification-bell"
        className={`relative flex items-center ${collapsed ? 'justify-center w-10 h-10' : 'gap-3 w-full px-4 py-3'}
          rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
        aria-label={`Notifications${unread.total ? `, ${unread.total} unread` : ''}`}
      >
        <span className="relative">
          <Bell className="h-5 w-5" />
          {unread.total > 0 && (
            <motion.span
              key={unread.total}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 16 }}
              className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/40"
              data-testid="notification-badge"
            >
              {unread.total > 99 ? '99+' : unread.total}
            </motion.span>
          )}
        </span>
        {!collapsed && (
          <>
            <span>Notifications</span>
            {unread.total > 0 && (
              <span className="ml-auto text-[10px] font-bold text-rose-500" data-testid="bell-new-label">{unread.total} new</span>
            )}
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed left-[260px] bottom-4 w-[380px] z-[60] rounded-2xl border border-slate-200/80 dark:border-slate-800/80
              bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/20 overflow-hidden max-h-[80vh] flex flex-col"
            data-testid="notification-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" />
                <span className="font-manrope font-semibold text-sm">Inbox</span>
                {unread.total > 0 && <Badge variant="secondary" className="text-[10px] h-5">{unread.total} unread</Badge>}
              </div>
              <button
                onClick={handleMarkAllRead}
                disabled={unread.total === 0}
                className="text-[11px] text-muted-foreground hover:text-indigo-500 disabled:opacity-40 transition-colors flex items-center gap-1"
                data-testid="mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto" data-testid="notification-list">
              {loading && items.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
              ) : recent.length === 0 ? (
                <div className="py-14 px-6 text-center space-y-2">
                  <Inbox className="h-7 w-7 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium">All quiet</p>
                  <p className="text-xs text-muted-foreground">When a brand replies, a creator collabs, or a deal closes — it lands here first.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {recent.map((n) => (
                    <NotificationRow key={n.notification_id} n={n} onAct={handleAct} onClick={handleClick} dense />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                data-testid="open-notifications-page"
              >
                Open notification center <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
