import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCheck, Trash2, Inbox, Sparkles, Filter, RefreshCw, Search,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { NotificationRow } from '../components/NotificationCenter';
import { toast } from 'sonner';
import { useNotifications } from '../context/NotificationContext';

const FILTERS = [
  { key: '',         label: 'All',       hint: 'Everything in one stream' },
  { key: 'network',  label: 'Network',   hint: 'Collab requests & connections' },
  { key: 'outreach', label: 'Outreach',  hint: 'Brand replies & pipeline' },
  { key: 'insights', label: 'Insights',  hint: 'Weekly digests & milestones' },
  { key: 'system',   label: 'System',    hint: 'CreatorOS announcements' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const {
    items, unread, loading,
    refresh, markRead, markAllRead, dismiss, clearRead, triggerDigest,
  } = useNotifications();
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter && n.category !== filter) return false;
      if (showUnreadOnly && n.read) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, showUnreadOnly, query]);

  const byPriority = useMemo(() => ({
    high: filtered.filter((n) => n.priority === 'high').length,
    normal: filtered.filter((n) => n.priority === 'normal').length,
    low: filtered.filter((n) => n.priority === 'low').length,
  }), [filtered]);

  const onClick = async (n) => {
    if (!n.read) await markRead(n.notification_id);
    if (n.action_url) navigate(n.action_url);
  };

  const onAct = async (n, action) => {
    if (action === 'dismiss') {
      try { await dismiss(n.notification_id); }
      catch { toast.error('Could not dismiss'); }
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead(filter || null);
    toast.success('All caught up');
  };

  const handleClearRead = async () => {
    await clearRead();
    toast.success('Read notifications cleared');
  };

  const handleDigest = async () => {
    try {
      const res = await triggerDigest();
      if (res.created) toast.success('Weekly digest ready');
      else toast.info('Digest already sent this week');
    } catch { toast.error('Could not generate digest'); }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-indigo-500 mb-1">Inbox</p>
            <h1 className="font-manrope text-3xl md:text-4xl font-bold flex items-center gap-3 tracking-tight">
              Notification Center
              {unread.total > 0 && (
                <Badge className="bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white border-0 text-[11px]">
                  {unread.total} unread
                </Badge>
              )}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1.5 text-sm max-w-xl">
              A calm, deliberate stream of what matters — brand replies, collab moves, weekly recaps. No noise.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5" data-testid="refresh-btn">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleDigest} className="gap-1.5" data-testid="trigger-digest-btn">
              <Sparkles className="h-3.5 w-3.5" /> Build weekly digest
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={unread.total === 0} className="gap-1.5" data-testid="mark-all-read-btn">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearRead} className="gap-1.5 text-rose-500 hover:text-rose-600" data-testid="clear-read-btn">
              <Trash2 className="h-3.5 w-3.5" /> Clear read
            </Button>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Unread',     value: unread.total,    accent: 'text-rose-500' },
            { label: 'High signal', value: byPriority.high, accent: 'text-amber-500' },
            { label: 'In stream',   value: filtered.length, accent: 'text-blue-500' },
            { label: 'Network',     value: unread.by_category.network || 0, accent: 'text-violet-500' },
          ].map((s) => (
            <Card key={s.label} className="overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</div>
                <div className={`font-manrope text-3xl font-bold mt-1 tabular-nums ${s.accent}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            const count = f.key ? (unread.by_category[f.key] || 0) : unread.total;
            return (
              <button
                key={f.key || 'all'}
                onClick={() => setFilter(f.key)}
                title={f.hint}
                data-testid={`filter-${f.key || 'all'}`}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'}`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`ml-1.5 inline-block min-w-[18px] px-1 rounded-full text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-rose-500/15 text-rose-500'}`}>{count}</span>
                )}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            data-testid="unread-only-toggle"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5
              ${showUnreadOnly
                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                : 'border-slate-200 dark:border-slate-800 text-muted-foreground'}`}
          >
            <Filter className="h-3 w-3" /> Unread only
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox…"
              className="h-8 pl-8 w-56 text-xs"
              data-testid="search-notifications"
            />
          </div>
        </div>

        {/* ── List ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading && items.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 px-6 text-center space-y-3" data-testid="empty-state">
                <Inbox className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="font-manrope text-lg font-semibold">Nothing to act on right now</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  This is the good kind of empty. Send a few pitches, accept a collab, or check back Sunday for your weekly digest.
                </p>
              </div>
            ) : (
              <div data-testid="notifications-feed">
                <AnimatePresence initial={false}>
                  {filtered.map((n) => (
                    <NotificationRow key={n.notification_id} n={n} onAct={onAct} onClick={onClick} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
