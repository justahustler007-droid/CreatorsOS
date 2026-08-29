import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, MapPin, TrendingUp, Target, Copy, Check, Zap, Wand2,
  ChevronLeft, ChevronRight, Activity, Flame, Globe, Bookmark, BookmarkCheck,
  Send, ExternalLink, Mail, Loader2, X
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { useNotifications } from '../context/NotificationContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const STATUS_STYLES = {
  pending:       { label: 'Pending',     dot: 'bg-slate-400',   glow: 'shadow-slate-400/40' },
  sent:          { label: 'Sent',        dot: 'bg-indigo-500',  glow: 'shadow-indigo-500/60' },
  viewed:        { label: 'Viewed',      dot: 'bg-cyan-500',    glow: 'shadow-cyan-500/60' },
  replied:       { label: 'Replied',     dot: 'bg-blue-500',    glow: 'shadow-blue-500/60' },
  negotiating:   { label: 'Negotiating', dot: 'bg-amber-500',   glow: 'shadow-amber-500/60' },
  closed_won:    { label: 'Won',         dot: 'bg-emerald-500', glow: 'shadow-emerald-500/60' },
  closed_lost:   { label: 'Lost',        dot: 'bg-rose-500',    glow: 'shadow-rose-500/60' },
};
const STATUS_ORDER = ['pending', 'sent', 'viewed', 'replied', 'negotiating', 'closed_won', 'closed_lost'];

// ── Animated match score ring ────────────────────────────────────────────
const MatchRing = ({ score, size = 60 }) => {
  const radius = (size - 8) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#10B981' : score >= 80 ? '#3B82F6' : score >= 70 ? '#F97316' : '#94A3B8';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="text-slate-200 dark:text-slate-800"/>
        <motion.circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-manrope font-bold text-sm">{score}</div>
    </div>
  );
};

// ── Brand card ────────────────────────────────────────────────────────────
const BrandCard = ({ brand, onSave, onPitch, onView }) => (
  <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
    <Card className="overflow-hidden h-full border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 backdrop-blur-xl hover:shadow-xl hover:shadow-blue-500/10 transition-all">
      <div className={`h-1 w-full bg-gradient-to-r ${brand.color}`}/>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-manrope font-bold text-lg shadow-lg shrink-0`}>
              {brand.logo}
            </div>
            <div className="min-w-0">
              <p className="font-manrope font-semibold truncate">{brand.name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3"/>{brand.region}{brand.city ? ` · ${brand.city}` : ''}
              </div>
            </div>
          </div>
          <MatchRing score={brand.match_score}/>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{brand.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {(brand.tags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget</div>
            <div className="font-manrope font-bold text-xs">{formatINR(brand.budget_min)}–{formatINR(brand.budget_max)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</div>
            <div className="font-manrope font-bold text-xs">{brand.category}</div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onView(brand)} data-testid={`view-brand-${brand.brand_id}`}>
            <ExternalLink className="h-3 w-3 mr-1"/>Details
          </Button>
          <Button size="sm" variant="outline" className="px-2" onClick={() => onSave(brand)} data-testid={`save-brand-${brand.brand_id}`} title={brand.saved ? 'Saved' : 'Save'}>
            {brand.saved ? <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500"/> : <Bookmark className="h-3.5 w-3.5"/>}
          </Button>
          <Button size="sm" className="flex-1 text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200" onClick={() => onPitch(brand)} data-testid={`pitch-brand-${brand.brand_id}`}>
            <Send className="h-3 w-3 mr-1"/>Pitch
          </Button>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

// ── Brand rail (swipeable carousel) ──────────────────────────────────────
const BrandRail = ({ title, icon: Icon, brands, accent, onSave, onPitch, onView, testId }) => {
  const [idx, setIdx] = useState(0);
  const refSetter = (el) => { if (el) el.scrollTo({ left: idx * 320, behavior: 'smooth' }); };
  if (!brands.length) return null;
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`}/>
          <h3 className="font-manrope font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">({brands.length})</span>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIdx(Math.max(0, idx - 1))}><ChevronLeft className="h-4 w-4"/></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIdx(Math.min(brands.length - 1, idx + 1))}><ChevronRight className="h-4 w-4"/></Button>
        </div>
      </div>
      <div ref={refSetter} className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory scroll-smooth">
        {brands.map((b) => (
          <div key={b.brand_id} className="snap-start shrink-0 w-[300px]">
            <BrandCard brand={b} onSave={onSave} onPitch={onPitch} onView={onView}/>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Brand detail dialog ──────────────────────────────────────────────────
const BrandDetailDialog = ({ brand, onClose, onSave, onPitch }) => (
  <Dialog open={!!brand} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="sm:max-w-lg" data-testid="brand-detail-dialog">
      {brand && (
        <>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-manrope font-bold text-xl shadow-lg`}>{brand.logo}</div>
              <div>
                <DialogTitle className="font-manrope text-xl">{brand.name}</DialogTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3"/>{brand.region}{brand.city ? ` · ${brand.city}` : ''} · {brand.category}</p>
              </div>
              <div className="ml-auto"><MatchRing score={brand.match_score}/></div>
            </div>
            <DialogDescription className="sr-only">Brand details, contact info and budget for {brand.name}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{brand.description}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget Range</div>
                <div className="font-manrope font-bold text-sm">{formatINR(brand.budget_min)} – {formatINR(brand.budget_max)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best for</div>
                <div className="font-medium text-xs">{(brand.fit_niches || []).join(', ')}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(brand.tags || []).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>

            <div className="space-y-2 text-sm">
              {brand.website && (
                <a href={brand.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-500 hover:underline" data-testid="brand-website-link">
                  <ExternalLink className="h-3.5 w-3.5"/>{brand.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {brand.instagram && (
                <a href={`https://instagram.com/${brand.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-pink-500 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5"/>{brand.instagram}
                </a>
              )}
              {brand.contact_email && (
                <a href={`mailto:${brand.contact_email}`} className="flex items-center gap-2 text-emerald-500 hover:underline" data-testid="brand-contact-email">
                  <Mail className="h-3.5 w-3.5"/>{brand.contact_email}
                </a>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onSave(brand)}>
              {brand.saved ? <><BookmarkCheck className="h-4 w-4 mr-1 text-emerald-500"/>Saved</> : <><Bookmark className="h-4 w-4 mr-1"/>Save</>}
            </Button>
            <Button onClick={() => onPitch(brand)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white">
              <Wand2 className="h-4 w-4 mr-1"/>Generate Pitch
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  </Dialog>
);

// ── Pitch composer dialog ────────────────────────────────────────────────
const PitchDialog = ({ open, brand, profile, onClose, onSent }) => {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [copied, setCopied] = useState(false);

  const buildPitch = useCallback(async () => {
    if (!brand) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai/generate-pitch`, { brand_id: brand.brand_id }, { withCredentials: true });
      setSubject(res.data.subject);
      setBody(res.data.body);
      const mid = Math.round(((brand.budget_min || 0) + (brand.budget_max || 0)) / 2);
      if (mid) setEstimatedValue(String(mid));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Pitch generation failed');
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    if (open && brand) {
      setSubject(`Collaboration with ${profile?.creator_name || 'me'} × ${brand.name}`);
      setBody('');
      setEstimatedValue('');
      buildPitch();
    }
  }, [open, brand, profile, buildPitch]);

  const copyAll = () => {
    if (!body) return;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast.success('Pitch copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const sendOutreach = async (markStatus) => {
    if (!subject || !body) return toast.error('Pitch is empty');
    try {
      const res = await axios.post(`${API}/outreach`, {
        brand_id: brand.brand_id, subject, body,
        estimated_value: estimatedValue ? parseInt(estimatedValue) : null,
      }, { withCredentials: true });
      if (markStatus && markStatus !== 'pending') {
        await axios.put(`${API}/outreach/${res.data.outreach_id}/status`, { status: markStatus }, { withCredentials: true });
      }
      toast.success(`Outreach saved · status: ${STATUS_STYLES[markStatus || 'pending'].label}`);
      onSent();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="pitch-dialog">
        <DialogHeader>
          <DialogTitle className="font-manrope flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-500"/>
            AI Pitch — {brand?.name}
            <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 text-[10px] ml-2">Gemini</Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">AI-generated outreach pitch composer for {brand?.name}.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin"/> Crafting your pitch...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="pitch-subject"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] font-mono text-sm" data-testid="pitch-body"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Value (₹)</Label>
                <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="optional"/>
              </div>
              {brand?.contact_email && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Brand Contact</Label>
                  <a href={`mailto:${brand.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                     className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 truncate"
                     data-testid="mailto-link">
                    <Mail className="h-3.5 w-3.5 text-emerald-500"/>{brand.contact_email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          <Button variant="outline" onClick={buildPitch} disabled={loading}><Sparkles className="h-4 w-4 mr-1"/>Regenerate</Button>
          <Button variant="outline" onClick={copyAll} disabled={loading}>
            {copied ? <Check className="h-4 w-4 mr-1 text-emerald-500"/> : <Copy className="h-4 w-4 mr-1"/>}{copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={() => sendOutreach('pending')} variant="outline" data-testid="save-pitch-btn">Save as Draft</Button>
          <Button onClick={() => sendOutreach('sent')} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white" data-testid="mark-sent-btn">
            <Send className="h-4 w-4 mr-1"/>Mark as Sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Pipeline column ──────────────────────────────────────────────────────
const PipelineColumn = ({ status, items, onUpdateStatus, onDelete }) => {
  const s = STATUS_STYLES[status];
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2.5 w-2.5 rounded-full ${s.dot} shadow-[0_0_12px] ${s.glow}`}/>
        <span className="text-xs font-semibold uppercase tracking-wider">{s.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        <AnimatePresence>
          {items.map((o) => (
            <motion.div key={o.outreach_id} layout
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-lg bg-white dark:bg-slate-800 p-2.5 border border-slate-200 dark:border-slate-700 hover:shadow-md transition group"
              data-testid={`outreach-card-${o.outreach_id}`}>
              <div className="flex items-start justify-between gap-1">
                <span className="font-medium text-sm truncate">{o.brand_name}</span>
                <button onClick={() => onDelete(o.outreach_id)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-rose-500" title="Delete">
                  <X className="h-3 w-3"/>
                </button>
              </div>
              {o.estimated_value > 0 && <div className="text-xs font-manrope font-bold mt-0.5">{formatINR(o.estimated_value)}</div>}
              <div className="flex flex-wrap gap-1 mt-2">
                {STATUS_ORDER.filter((st) => st !== o.status).slice(0, 3).map((st) => (
                  <button key={st} onClick={() => onUpdateStatus(o.outreach_id, st)}
                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    title={`Move to ${STATUS_STYLES[st].label}`}>
                    → {STATUS_STYLES[st].label}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && <div className="text-[11px] text-muted-foreground italic text-center py-3">empty</div>}
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────
export default function BrandFinder() {
  const [profile, setProfile] = useState(null);
  const [brands, setBrands] = useState([]);
  const [pipeline, setPipeline] = useState({});
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ q: '', category: '', region: '' });
  const [filterOptions, setFilterOptions] = useState({ categories: [], regions: [] });
  const [selected, setSelected] = useState(null);
  const [pitchBrand, setPitchBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const { refresh: refreshNotifications } = useNotifications();

  const loadProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/profile`, { withCredentials: true });
      setProfile(res.data);
    } catch { /* not onboarded yet */ }
  }, []);

  const loadBrands = useCallback(async () => {
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.category) params.category = filters.category;
      if (filters.region) params.region = filters.region;
      const res = await axios.get(`${API}/brands`, { params, withCredentials: true });
      setBrands(res.data);
    } catch (e) {
      toast.error('Failed to load brands');
    }
  }, [filters]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/brands/meta/filters`, { withCredentials: true });
      setFilterOptions(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadPipeline = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        axios.get(`${API}/outreach/pipeline`, { withCredentials: true }),
        axios.get(`${API}/outreach/stats`, { withCredentials: true }),
      ]);
      setPipeline(p.data);
      setStats(s.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadProfile(), loadFilterOptions(), loadPipeline()]).finally(() => setLoading(false));
  }, [loadProfile, loadFilterOptions, loadPipeline]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // ── Sections ─────────────────────────────────────────────────────────
  const highMatch = useMemo(() => [...brands].sort((a, b) => b.match_score - a.match_score).slice(0, 8), [brands]);
  const localBrands = useMemo(() => brands.filter((b) => b.region === 'India').slice(0, 12), [brands]);
  const globalBrands = useMemo(() => brands.filter((b) => b.region === 'Global'), [brands]);
  const highBudget = useMemo(() => [...brands].sort((a, b) => b.budget_max - a.budget_max).slice(0, 8), [brands]);
  const savedBrands = useMemo(() => brands.filter((b) => b.saved), [brands]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const toggleSave = async (brand) => {
    try {
      if (brand.saved) {
        await axios.delete(`${API}/brands/save/${brand.brand_id}`, { withCredentials: true });
        toast.success(`${brand.name} removed from saved`);
      } else {
        await axios.post(`${API}/brands/save`, { brand_id: brand.brand_id }, { withCredentials: true });
        toast.success(`${brand.name} saved`);
      }
      setBrands((bs) => bs.map((b) => b.brand_id === brand.brand_id ? { ...b, saved: !b.saved } : b));
      if (selected && selected.brand_id === brand.brand_id) {
        setSelected({ ...selected, saved: !selected.saved });
      }
    } catch (e) {
      toast.error('Save failed');
    }
  };

  const openPitch = (brand) => {
    setPitchBrand(brand);
    setSelected(null);
  };

  const updateOutreachStatus = async (id, status) => {
    try {
      await axios.put(`${API}/outreach/${id}/status`, { status }, { withCredentials: true });
      loadPipeline();
      refreshNotifications({ silent: true });
    } catch (e) {
      toast.error('Status update failed');
    }
  };

  const deleteOutreach = async (id) => {
    try {
      await axios.delete(`${API}/outreach/${id}`, { withCredentials: true });
      loadPipeline();
      refreshNotifications({ silent: true });
      toast.success('Outreach removed');
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-manrope text-2xl md:text-3xl font-bold flex items-center gap-2">
              Brand Deal Finder <Sparkles className="h-6 w-6 text-amber-500 animate-pulse"/>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              Real brands. Real contacts. Real outreach tracked across your pipeline.
            </p>
          </div>
          {!profile?.niche && (
            <Badge variant="secondary" className="self-start md:self-auto">Complete your profile for better matches →</Badge>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Total Outreach</div><div className="font-manrope text-2xl font-bold">{stats.total}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Response Rate</div><div className="font-manrope text-2xl font-bold text-blue-500">{stats.response_rate}%</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Active Pipeline</div><div className="font-manrope text-2xl font-bold">{stats.by_status.replied + stats.by_status.negotiating}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Pipeline Value</div><div className="font-manrope text-2xl font-bold text-emerald-500">{formatINR(stats.pipeline_value || 0)}</div></CardContent></Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Search brands, tags, keywords..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} data-testid="brand-search"/>
              <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="h-10 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm" data-testid="filter-category">
                <option value="">All categories</option>
                {filterOptions.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                className="h-10 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 text-sm" data-testid="filter-region">
                <option value="">All regions</option>
                {filterOptions.regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
        )}

        {/* Rails */}
        {!loading && brands.length > 0 && (
          <>
            <BrandRail title="High Match for You" icon={Flame} accent="text-rose-500" brands={highMatch}
              onSave={toggleSave} onPitch={openPitch} onView={setSelected} testId="rail-high-match"/>
            {savedBrands.length > 0 && (
              <BrandRail title="Your Saved Brands" icon={BookmarkCheck} accent="text-emerald-500" brands={savedBrands}
                onSave={toggleSave} onPitch={openPitch} onView={setSelected} testId="rail-saved"/>
            )}
            <BrandRail title="Local Brands (India)" icon={MapPin} accent="text-emerald-500" brands={localBrands}
              onSave={toggleSave} onPitch={openPitch} onView={setSelected} testId="rail-local"/>
            <BrandRail title="Global Brands" icon={Globe} accent="text-blue-500" brands={globalBrands}
              onSave={toggleSave} onPitch={openPitch} onView={setSelected} testId="rail-global"/>
            <BrandRail title="High Budget" icon={TrendingUp} accent="text-violet-500" brands={highBudget}
              onSave={toggleSave} onPitch={openPitch} onView={setSelected} testId="rail-high-budget"/>
          </>
        )}

        {!loading && brands.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-muted-foreground">
            No brands match your filters. Try clearing them.
          </div>
        )}

        {/* Outreach Pipeline */}
        <Card data-testid="outreach-pipeline">
          <CardHeader>
            <CardTitle className="font-manrope flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-blue-500"/>Outreach Pipeline
              {stats && <Badge variant="secondary" className="ml-2">{stats.total} total</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STATUS_ORDER.map((status) => (
                <PipelineColumn key={status} status={status}
                  items={(pipeline[status]) || []}
                  onUpdateStatus={updateOutreachStatus}
                  onDelete={deleteOutreach}/>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <BrandDetailDialog brand={selected} onClose={() => setSelected(null)} onSave={toggleSave} onPitch={openPitch}/>
      <PitchDialog open={!!pitchBrand} brand={pitchBrand} profile={profile}
        onClose={() => setPitchBrand(null)} onSent={loadPipeline}/>
    </DashboardLayout>
  );
}
