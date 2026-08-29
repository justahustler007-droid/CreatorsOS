import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  TrendingUp, 
  Wallet, 
  Handshake, 
  Clock, 
  AlertCircle,
  Youtube,
  Instagram,
  ExternalLink,
  Trophy,
  Target,
  Star,
  Edit
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#3B82F6', '#F97316', '#EF4444', '#8B5CF6', '#10B981'];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-blue-600">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [profile, setProfile] = useState(null);
  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMilestone, setNewMilestone] = useState(null);

  useEffect(() => {
    // ── Hydrate profile from localStorage instantly (MVP: no backend
    // ── dependency for onboarding). Backend stats/insights load in parallel
    // ── but a failure on /api/profile no longer breaks the dashboard.
    try {
      const cached = localStorage.getItem('creatoros_profile');
      if (cached) setProfile(JSON.parse(cached));
    } catch (_) { /* corrupt JSON → ignore */ }

    const fetchData = async () => {
      try {
        const [statsRes, insightsRes, milestonesRes, profileRes, paymentsRes, cashflowRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`, { withCredentials: true }),
          axios.get(`${API}/dashboard/insights`, { withCredentials: true }),
          axios.get(`${API}/dashboard/milestones`, { withCredentials: true }),
          axios.get(`${API}/profile`, { withCredentials: true }).catch(() => null),
          axios.get(`${API}/dashboard/upcoming-payments`, { withCredentials: true }),
          axios.get(`${API}/dashboard/cashflow`, { withCredentials: true })
        ]);

        setStats(statsRes.data);
        setInsights(insightsRes.data);
        // Server profile is a nice-to-have; localStorage is the source of truth.
        if (profileRes?.data) setProfile(profileRes.data);
        setUpcomingPayments(paymentsRes.data);
        setCashflow(cashflowRes.data);
        
        // Check for new milestones - only show if achieved
        const achievedMilestones = milestonesRes.data.filter(m => m.achieved);
        const previousMilestones = JSON.parse(localStorage.getItem('achieved_milestones') || '[]');
        const currentAchieved = achievedMilestones.map(m => m.id);
        const newlyAchieved = currentAchieved.find(id => !previousMilestones.includes(id));
        
        if (newlyAchieved) {
          const milestone = achievedMilestones.find(m => m.id === newlyAchieved);
          setNewMilestone(milestone);
          localStorage.setItem('achieved_milestones', JSON.stringify(currentAchieved));
        }
        
        setMilestones(achievedMilestones);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Keep dashboard in sync when financial data changes in another module
    // (Income / Invoices / Deals / Analytics) — they emit this event on every
    // mutation so the stats here update instantly without a manual refresh.
    const onDataChanged = () => fetchData();
    window.addEventListener('creatoros:data-changed', onDataChanged);
    window.addEventListener('focus', onDataChanged);
    return () => {
      window.removeEventListener('creatoros:data-changed', onDataChanged);
      window.removeEventListener('focus', onDataChanged);
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  const totalUpcoming = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <DashboardLayout>
      {/* Milestone Celebration Modal */}
      {newMilestone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setNewMilestone(null)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <h2 className="font-manrope text-2xl font-bold mb-2">Milestone Achieved!</h2>
            <p className="text-lg text-muted-foreground mb-4">{newMilestone.name}</p>
            <Button onClick={() => setNewMilestone(null)} className="w-full">
              Awesome! 🎉
            </Button>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="font-manrope text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Welcome back, {profile?.creator_name || user?.name?.split(' ')[0] || 'Creator'}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's your creator business overview
          </p>
        </motion.div>

        {/* Creator Profile Card - Clickable */}
        {profile && (
          <motion.div variants={itemVariants}>
            <Card 
              className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={() => navigate('/settings')}
              data-testid="creator-profile-card"
            >
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {profile.creator_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h2 className="font-manrope text-xl font-bold">{profile.creator_name}</h2>
                      {profile.bio && <p className="text-sm text-muted-foreground max-w-md truncate">{profile.bio}</p>}
                      <p className="text-muted-foreground capitalize">{profile.niche || 'Creator'} • {profile.follower_count?.toLocaleString() || 0} followers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {profile.youtube_link && (
                      <a href={profile.youtube_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Youtube className="h-4 w-4 text-red-500" />
                          YouTube
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    {profile.instagram_handle && (
                      <a href={`https://instagram.com/${profile.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Instagram className="h-4 w-4 text-pink-500" />
                          Instagram
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" className="gap-2" data-testid="edit-profile-btn">
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Creator Insights Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-hover" data-testid="insight-deals-closed">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deals Closed</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {insights?.total_deals_closed || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="insight-total-revenue">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {formatCurrency(insights?.total_revenue || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="insight-avg-deal">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Deal Value</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {formatCurrency(insights?.average_deal_value || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="insight-top-platform">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Platform</p>
                  <p className="font-manrope text-2xl font-bold mt-1 capitalize">
                    {insights?.top_platform || 'N/A'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Star className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Milestones - Only show if there are achieved milestones */}
        {milestones.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card data-testid="milestones-card">
              <CardHeader>
                <CardTitle className="font-manrope flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Creator Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {milestones.map((milestone) => (
                    <Badge
                      key={milestone.id}
                      className="py-2 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0"
                    >
                      <Trophy className="h-3 w-3 mr-1" />
                      {milestone.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-hover" data-testid="stat-month-revenue">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {formatCurrency(stats?.month_revenue || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="stat-active-deals">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Deals</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {stats?.active_deals || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Handshake className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="stat-paid-deals">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid Deals</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {stats?.paid_deals || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="stat-pending-payments">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payments</p>
                  <p className="font-manrope text-2xl font-bold mt-1">
                    {formatCurrency(stats?.pending_payments || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card data-testid="revenue-chart">
            <CardHeader>
              <CardTitle className="font-manrope">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthly_revenue || []}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Source */}
          <Card data-testid="revenue-by-source">
            <CardHeader>
              <CardTitle className="font-manrope">Revenue by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center">
                {stats?.revenue_by_source?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.revenue_by_source}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.revenue_by_source.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full text-center text-muted-foreground">
                    No data yet. Start tracking income!
                  </div>
                )}
                {stats?.revenue_by_source?.length > 0 && (
                  <div className="space-y-2 ml-4">
                    {stats.revenue_by_source.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="capitalize">{item.name.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Reminders & Cashflow */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Reminders */}
          <Card data-testid="payment-reminders">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-manrope">Payment Reminders</CardTitle>
                {upcomingPayments.filter(p => p.status === 'overdue').length > 0 && (
                  <Badge variant="destructive">
                    {upcomingPayments.filter(p => p.status === 'overdue').length} overdue
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {upcomingPayments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingPayments.slice(0, 5).map((payment) => (
                    <div 
                      key={payment.deal_id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        payment.status === 'overdue' ? 'bg-red-50 dark:bg-red-900/20' :
                        payment.status === 'due_soon' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                        'bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{payment.brand_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.status === 'overdue' 
                            ? `${Math.abs(payment.days_until)} days overdue`
                            : `Due in ${payment.days_until} days`
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                        {payment.status === 'overdue' && (
                          <AlertCircle className="h-4 w-4 text-red-600 ml-auto" />
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      Total upcoming: <span className="font-semibold text-foreground">{formatCurrency(totalUpcoming)}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming payments
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cashflow Timeline */}
          <Card data-testid="cashflow-timeline">
            <CardHeader>
              <CardTitle className="font-manrope">Cashflow Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default Dashboard;
