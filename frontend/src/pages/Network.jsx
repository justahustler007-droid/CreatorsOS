import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Users, MapPin, Sparkles, ShieldCheck, Flame, TrendingUp, Zap, Search,
  CheckCircle2, Instagram, Youtube, Loader2, Bell, Check, X, Inbox, Send,
  Globe, UserPlus, Link as LinkIcon
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { useNotifications } from '../context/NotificationContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatFollowers = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};

const PlatformIcon = ({ platform, className = 'h-3.5 w-3.5' }) => {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes('youtube')) return <Youtube className={className + ' text-red-500'}/>;
  if (p.includes('instagram')) return <Instagram className={className + ' text-pink-500'}/>;
  if (p === 'both') return <span className="inline-flex gap-0.5"><Instagram className={className + ' text-pink-500'}/><Youtube className={className + ' text-red-500'}/></span>;
  return null;
};

// ── Compatibility ring ───────────────────────────────────────────────────
const CompatRing = ({ score, size = 56 }) => {
  const radius = (size - 6) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (score / 100) * c;
  const color = score >= 85 ? '#10B981' : score >= 70 ? '#3B82F6' : score >= 55 ? '#F97316' : '#94A3B8';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="3.5" fill="none" className="text-slate-200 dark:text-slate-800"/>
        <motion.circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-manrope font-bold text-xs">{score}</div>
    </div>
  );
};

const TrustBar = ({ risk }) => {
  const trust = 100 - risk;
  const color = trust >= 90 ? 'bg-emerald-500' : trust >= 80 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3"/>Authentic Audience</span>
        <span className="font-medium">{trust}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: trust + '%' }} transition={{ duration: 0.8 }} className={`h-full ${color}`}/>
      </div>
    </div>
  );
};

// ── Creator card ─────────────────────────────────────────────────────────
const CreatorCard = ({ creator, onCollab }) => {
  const initial = (creator.creator_name || 'C').charAt(0).toUpperCase();
  const requested = !!creator.request_status;
  const accepted = creator.request_status === 'accepted';

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Card className="overflow-hidden h-full border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 hover:shadow-xl hover:shadow-violet-500/10 transition-all">
        <div className={`h-1 w-full bg-gradient-to-r ${creator.gradient}`}/>
        <CardContent className="pt-5 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              {creator.picture
                ? <img src={creator.picture} alt={creator.creator_name} className="h-12 w-12 rounded-full object-cover shadow-lg"/>
                : <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${creator.gradient} flex items-center justify-center text-white font-manrope font-bold shadow-lg`}>{initial}</div>}
              {creator.fake_follower_risk <= 8 && (
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-manrope font-semibold leading-tight truncate">{creator.creator_name}</p>
              {creator.instagram_handle && <p className="text-xs text-muted-foreground truncate">@{creator.instagram_handle.replace('@','')}</p>}
              <div className="flex items-center gap-1.5 mt-1">
                <PlatformIcon platform={creator.platform}/>
                {creator.niche && <span className="text-[11px] text-muted-foreground">{creator.niche}</span>}
              </div>
            </div>
            <CompatRing score={creator.compatibility}/>
          </div>

          {creator.bio && <p className="text-xs text-muted-foreground line-clamp-2">{creator.bio}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Followers</div>
              <div className="font-manrope font-bold text-sm">{formatFollowers(creator.follower_count)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Location</div>
              <div className="font-manrope font-bold text-xs truncate flex items-center justify-center gap-1"><MapPin className="h-2.5 w-2.5"/>{creator.location || '—'}</div>
            </div>
          </div>

          <TrustBar risk={creator.fake_follower_risk}/>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-1">
              {creator.youtube_link && <a href={creator.youtube_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-red-500"><Youtube className="h-3.5 w-3.5"/></a>}
              {creator.instagram_handle && <a href={`https://instagram.com/${creator.instagram_handle.replace('@','')}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-pink-500"><Instagram className="h-3.5 w-3.5"/></a>}
            </div>
            {accepted ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px]"><CheckCircle2 className="h-3 w-3 mr-1"/>Connected</Badge>
            ) : requested ? (
              <Badge variant="secondary" className="text-[11px]">Request {creator.request_status}</Badge>
            ) : (
              <Button size="sm" onClick={() => onCollab(creator)} className="h-7 text-[11px] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white gap-1" data-testid={`collab-btn-${creator.user_id}`}>
                <Zap className="h-3 w-3"/>Collab
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ── Collab request dialog ────────────────────────────────────────────────
const CollabDialog = ({ creator, onClose, onSent }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (creator) {
      setMessage(`Hey ${creator.creator_name}! Love your work on ${creator.platform || 'your platform'}. I think our audiences would resonate really well — would you be open to a quick collab brainstorm?`);
    }
  }, [creator]);

  const send = async () => {
    if (!message.trim()) return toast.error('Add a message');
    setSending(true);
    try {
      await axios.post(`${API}/network/requests`, { to_user_id: creator.user_id, message }, { withCredentials: true });
      toast.success(`Collab request sent to ${creator.creator_name}`);
      onSent();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!creator} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="collab-dialog">
        {creator && (
          <>
            <DialogHeader>
              <DialogTitle className="font-manrope flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-violet-500"/>Send Collab Request
              </DialogTitle>
              <DialogDescription className="sr-only">Send a collaboration request to {creator.creator_name}.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${creator.gradient} flex items-center justify-center text-white font-bold`}>{creator.creator_name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{creator.creator_name}</p>
                <p className="text-xs text-muted-foreground">{creator.niche} · {formatFollowers(creator.follower_count)} followers</p>
              </div>
              <CompatRing score={creator.compatibility} size={44}/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Your message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={500} data-testid="collab-message"/>
              <p className="text-[10px] text-muted-foreground text-right">{message.length}/500</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={send} disabled={sending} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white" data-testid="send-collab-btn">
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : <Send className="h-4 w-4 mr-1"/>}
                Send Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Request inbox row ────────────────────────────────────────────────────
const RequestRow = ({ req, perspective, onAct }) => {
  const other = req.other_creator;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition">
      <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${other.gradient} flex items-center justify-center text-white font-bold shrink-0`}>
        {(other.creator_name || 'C').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{other.creator_name}</p>
          <Badge variant="secondary" className="text-[10px]">{req.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{req.message}</p>
      </div>
      {perspective === 'incoming' && req.status === 'pending' && (
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onAct(req.request_id, 'rejected')} data-testid={`reject-${req.request_id}`}><X className="h-3.5 w-3.5"/></Button>
          <Button size="sm" className="h-7 px-2 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => onAct(req.request_id, 'accepted')} data-testid={`accept-${req.request_id}`}><Check className="h-3.5 w-3.5"/></Button>
        </div>
      )}
      {perspective === 'outgoing' && req.status === 'pending' && (
        <Button size="sm" variant="ghost" className="h-7" onClick={() => onAct(req.request_id, 'cancelled')}>Cancel</Button>
      )}
    </div>
  );
};

export default function Network() {
  const [creators, setCreators] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [connections, setConnections] = useState([]);
  const [stats, setStats] = useState({ incoming_pending: 0, sent_total: 0, connections: 0 });
  const [filters, setFilters] = useState({ q: '', niche: '', platform: '', sort: 'compatibility' });
  const [discoverable, setDiscoverable] = useState(false);
  const [collabTarget, setCollabTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const { refresh: refreshNotifications } = useNotifications();

  const loadDiscoverable = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/network/me/discoverable`, { withCredentials: true });
      setDiscoverable(res.data.discoverable);
    } catch { /* ignore */ }
  }, []);

  const loadCreators = useCallback(async () => {
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.niche) params.niche = filters.niche;
      if (filters.platform) params.platform = filters.platform;
      if (filters.sort) params.sort = filters.sort;
      const res = await axios.get(`${API}/network/discover`, { params, withCredentials: true });
      setCreators(res.data);
    } catch { toast.error('Failed to load creators'); }
  }, [filters]);

  const loadRequests = useCallback(async () => {
    try {
      const [inc, out, conn, st] = await Promise.all([
        axios.get(`${API}/network/requests/incoming`, { withCredentials: true }),
        axios.get(`${API}/network/requests/outgoing`, { withCredentials: true }),
        axios.get(`${API}/network/connections`, { withCredentials: true }),
        axios.get(`${API}/network/stats`, { withCredentials: true }),
      ]);
      setIncoming(inc.data);
      setOutgoing(out.data);
      setConnections(conn.data);
      setStats(st.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadDiscoverable(), loadRequests()]).finally(() => setLoading(false));
  }, [loadDiscoverable, loadRequests]);

  useEffect(() => { loadCreators(); }, [loadCreators]);

  const toggleDiscoverable = async (v) => {
    try {
      await axios.post(`${API}/network/discoverable?enabled=${v}`, {}, { withCredentials: true });
      setDiscoverable(v);
      toast.success(v ? 'You are now discoverable' : 'You are now hidden from discovery');
      loadCreators();
    } catch { toast.error('Failed to update'); }
  };

  const actOnRequest = async (requestId, status) => {
    try {
      await axios.put(`${API}/network/requests/${requestId}`, { status }, { withCredentials: true });
      toast.success(`Request ${status}`);
      loadRequests();
      loadCreators();
      refreshNotifications({ silent: true });
    } catch { toast.error('Update failed'); }
  };

  const niches = useMemo(() => Array.from(new Set(creators.map((c) => c.niche).filter(Boolean))).sort(), [creators]);

  const trusted = useMemo(() => creators.filter((c) => c.fake_follower_risk <= 8), [creators]);
  const sameNiche = useMemo(() => filters.niche ? creators : (creators.length ? creators.filter((c) => c.niche) : []), [creators, filters.niche]);

  const avgCompat = creators.length ? Math.round(creators.reduce((s, c) => s + c.compatibility, 0) / creators.length) : 0;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-manrope text-2xl md:text-3xl font-bold flex items-center gap-2">
              Creator Network <Users className="h-6 w-6 text-violet-500"/>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              Discover real creators in your niche, send collab requests, and build your network.
            </p>
          </div>
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <Label htmlFor="discoverable-toggle" className="text-xs cursor-pointer">Discoverable</Label>
                <p className="text-[10px] text-muted-foreground">{discoverable ? 'Visible in directory' : 'Hidden from others'}</p>
              </div>
              <Switch id="discoverable-toggle" checked={discoverable} onCheckedChange={toggleDiscoverable} data-testid="discoverable-toggle"/>
            </div>
          </Card>
        </div>

        {/* Stat widgets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="card-hover"><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Avg Compatibility</p><p className="font-manrope text-2xl font-bold mt-1">{avgCompat}%</p></div>
            <CompatRing score={avgCompat} size={48}/>
          </div></CardContent></Card>
          <Card className="card-hover"><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Connections</p><p className="font-manrope text-2xl font-bold mt-1 text-emerald-500">{stats.connections}</p></div>
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><LinkIcon className="h-6 w-6 text-emerald-500"/></div>
          </div></CardContent></Card>
          <Card className="card-hover"><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Incoming Pending</p><p className="font-manrope text-2xl font-bold mt-1 text-amber-500">{stats.incoming_pending}</p></div>
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center relative">
              <Bell className="h-6 w-6 text-amber-500"/>
              {stats.incoming_pending > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full animate-pulse"/>}
            </div>
          </div></CardContent></Card>
          <Card className="card-hover"><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Sent Requests</p><p className="font-manrope text-2xl font-bold mt-1 text-blue-500">{stats.sent_total}</p></div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Send className="h-6 w-6 text-blue-500"/></div>
          </div></CardContent></Card>
        </div>

        {/* Tabs: Discover / Inbox / Sent / Connections */}
        <Tabs defaultValue="discover" className="space-y-4">
          <TabsList>
            <TabsTrigger value="discover" data-testid="tab-discover"><Sparkles className="h-3.5 w-3.5 mr-1"/>Discover</TabsTrigger>
            <TabsTrigger value="inbox" data-testid="tab-inbox" className="relative">
              <Inbox className="h-3.5 w-3.5 mr-1"/>Inbox
              {stats.incoming_pending > 0 && <span className="ml-1 inline-block bg-rose-500 text-white rounded-full text-[9px] px-1.5 py-0.5">{stats.incoming_pending}</span>}
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent"><Send className="h-3.5 w-3.5 mr-1"/>Sent</TabsTrigger>
            <TabsTrigger value="connections" data-testid="tab-connections"><LinkIcon className="h-3.5 w-3.5 mr-1"/>Connections</TabsTrigger>
          </TabsList>

          {/* ── Discover ──────────────────────────────────────────────── */}
          <TabsContent value="discover" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input placeholder="Search creators..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="pl-9" data-testid="creator-search"/>
                  </div>
                  <select value={filters.niche} onChange={(e) => setFilters({ ...filters, niche: e.target.value })}
                    className="h-10 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm" data-testid="filter-niche">
                    <option value="">All niches</option>
                    {niches.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                    className="h-10 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm" data-testid="filter-sort">
                    <option value="compatibility">Best match</option>
                    <option value="followers">Most followers</option>
                    <option value="trusted">Most authentic</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
            ) : creators.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-muted-foreground space-y-2">
                <Globe className="h-8 w-8 mx-auto opacity-30"/>
                <p>No discoverable creators match your filters yet.</p>
                <p className="text-xs">Once more creators enable discoverability, they'll show up here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="creator-grid">
                {creators.map((c) => <CreatorCard key={c.user_id} creator={c} onCollab={setCollabTarget}/>)}
              </div>
            )}
          </TabsContent>

          {/* ── Inbox ─────────────────────────────────────────────────── */}
          <TabsContent value="inbox" className="space-y-3" data-testid="inbox-panel">
            {incoming.length === 0
              ? <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-muted-foreground">No incoming requests yet.</div>
              : incoming.map((r) => <RequestRow key={r.request_id} req={r} perspective="incoming" onAct={actOnRequest}/>)}
          </TabsContent>

          {/* ── Sent ──────────────────────────────────────────────────── */}
          <TabsContent value="sent" className="space-y-3" data-testid="sent-panel">
            {outgoing.length === 0
              ? <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-muted-foreground">You haven't sent any requests yet.</div>
              : outgoing.map((r) => <RequestRow key={r.request_id} req={r} perspective="outgoing" onAct={actOnRequest}/>)}
          </TabsContent>

          {/* ── Connections ──────────────────────────────────────────── */}
          <TabsContent value="connections" className="space-y-3" data-testid="connections-panel">
            {connections.length === 0
              ? <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-muted-foreground">No active connections yet. Accept incoming requests or send some.</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {connections.map((c) => <CreatorCard key={c.user_id} creator={{ ...c, compatibility: 95, request_status: 'accepted' }} onCollab={() => {}}/>)}
                </div>
              )
            }
          </TabsContent>
        </Tabs>
      </motion.div>

      <CollabDialog creator={collabTarget} onClose={() => setCollabTarget(null)} onSent={() => { loadRequests(); loadCreators(); refreshNotifications({ silent: true }); }}/>
    </DashboardLayout>
  );
}
