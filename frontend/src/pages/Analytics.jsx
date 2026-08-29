import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { 
  Plus, 
  Trash2, 
  TrendingUp,
  Eye,
  Heart,
  DollarSign
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' }
];

const CONTENT_TYPES = [
  { value: 'reel', label: 'Reel' },
  { value: 'video', label: 'Video' },
  { value: 'story', label: 'Story' },
  { value: 'post', label: 'Post' }
];

const COLORS = ['#3B82F6', '#F97316', '#EF4444', '#8B5CF6'];

export const Analytics = () => {
  const [contentList, setContentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    platform: '',
    content_type: '',
    views: '',
    engagement_rate: '',
    revenue: ''
  });

  const fetchContent = async () => {
    try {
      const response = await axios.get(`${API}/content`, { withCredentials: true });
      setContentList(response.data);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
    const onChanged = () => fetchContent();
    window.addEventListener('creatoros:data-changed', onChanged);
    window.addEventListener('focus', onChanged);
    return () => {
      window.removeEventListener('creatoros:data-changed', onChanged);
      window.removeEventListener('focus', onChanged);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.platform || !formData.content_type || !formData.views || !formData.revenue) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/content`, {
        ...formData,
        views: parseInt(formData.views),
        engagement_rate: parseFloat(formData.engagement_rate || 0),
        revenue: parseFloat(formData.revenue)
      }, { withCredentials: true });
      
      toast.success('Content added successfully');
      setDialogOpen(false);
      setFormData({
        platform: '',
        content_type: '',
        views: '',
        engagement_rate: '',
        revenue: ''
      });
      fetchContent();
    } catch (error) {
      console.error('Error adding content:', error);
      toast.error('Failed to add content');
    }
  };

  const handleDelete = async (contentId) => {
    if (!window.confirm('Are you sure you want to delete this content record?')) return;

    // Optimistic UI — drop the row immediately
    const prev = contentList;
    setContentList((arr) => arr.filter((c) => c.content_id !== contentId));

    try {
      await axios.delete(`${API}/content/${contentId}`, { withCredentials: true });
      toast.success('Content deleted');
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      setContentList(prev);   // rollback
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  // Calculate analytics
  const totalRevenue = contentList.reduce((sum, c) => sum + c.revenue, 0);
  const totalViews = contentList.reduce((sum, c) => sum + c.views, 0);
  const avgEngagement = contentList.length > 0 
    ? (contentList.reduce((sum, c) => sum + c.engagement_rate, 0) / contentList.length).toFixed(2)
    : 0;
  
  // Revenue per 1000 views (RPM)
  const rpm = totalViews > 0 ? ((totalRevenue / totalViews) * 1000).toFixed(2) : 0;

  // Revenue by content type
  const revenueByType = contentList.reduce((acc, content) => {
    const existing = acc.find(t => t.name === content.content_type);
    if (existing) {
      existing.value += content.revenue;
    } else {
      acc.push({ name: content.content_type, value: content.revenue });
    }
    return acc;
  }, []);

  // Revenue by platform
  const revenueByPlatform = contentList.reduce((acc, content) => {
    const existing = acc.find(p => p.platform === content.platform);
    if (existing) {
      existing.revenue += content.revenue;
      existing.views += content.views;
    } else {
      acc.push({ platform: content.platform, revenue: content.revenue, views: content.views });
    }
    return acc;
  }, []);

  // Best performing content
  const bestContent = [...contentList].sort((a, b) => {
    const rpmA = (a.revenue / a.views) * 1000;
    const rpmB = (b.revenue / b.views) * 1000;
    return rpmB - rpmA;
  }).slice(0, 5);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-manrope text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Content Analytics
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Track revenue per content and identify top performers
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="add-content-btn">
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-manrope">Add Content Revenue</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Platform *</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value) => setFormData({...formData, platform: value})}
                    >
                      <SelectTrigger data-testid="content-platform-select">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map(platform => (
                          <SelectItem key={platform.value} value={platform.value}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Content Type *</Label>
                    <Select
                      value={formData.content_type}
                      onValueChange={(value) => setFormData({...formData, content_type: value})}
                    >
                      <SelectTrigger data-testid="content-type-select">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Views *</Label>
                    <Input
                      type="number"
                      value={formData.views}
                      onChange={(e) => setFormData({...formData, views: e.target.value})}
                      placeholder="100000"
                      data-testid="content-views-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Engagement Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.engagement_rate}
                      onChange={(e) => setFormData({...formData, engagement_rate: e.target.value})}
                      placeholder="4.5"
                      data-testid="content-engagement-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Revenue (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.revenue}
                    onChange={(e) => setFormData({...formData, revenue: e.target.value})}
                    placeholder="25000"
                    data-testid="content-revenue-input"
                  />
                </div>
                
                <Button type="submit" className="w-full" data-testid="submit-content-btn">
                  Add Content
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="total-content-revenue">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="font-manrope text-xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="total-views">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="font-manrope text-xl font-bold">{(totalViews/1000).toFixed(0)}K</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="avg-engagement">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Engagement</p>
                  <p className="font-manrope text-xl font-bold">{avgEngagement}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="rpm-stat">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RPM (₹/1K views)</p>
                  <p className="font-manrope text-xl font-bold">₹{rpm}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Content Type */}
          <Card data-testid="revenue-by-type-chart">
            <CardHeader>
              <CardTitle className="font-manrope">Revenue by Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center">
                {revenueByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {revenueByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full text-center text-muted-foreground">
                    No data yet. Start tracking content!
                  </div>
                )}
                {revenueByType.length > 0 && (
                  <div className="space-y-2 ml-4">
                    {revenueByType.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="capitalize">{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Platform */}
          <Card data-testid="revenue-by-platform-chart">
            <CardHeader>
              <CardTitle className="font-manrope">Revenue by Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByPlatform}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="platform" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip formatter={(value, name) => [name === 'revenue' ? formatCurrency(value) : value, name]} />
                    <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Best Performing Content */}
        <Card data-testid="best-content-card">
          <CardHeader>
            <CardTitle className="font-manrope">Best Performing Content</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : bestContent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Type</th>
                      <th>Views</th>
                      <th>Engagement</th>
                      <th>Revenue</th>
                      <th>RPM</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestContent.map((content, index) => {
                      const contentRpm = ((content.revenue / content.views) * 1000).toFixed(2);
                      return (
                        <tr key={content.content_id} data-testid={`content-row-${content.content_id}`}>
                          <td className="capitalize">{content.platform}</td>
                          <td>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full capitalize">
                              {content.content_type}
                            </span>
                          </td>
                          <td>{(content.views/1000).toFixed(0)}K</td>
                          <td>{content.engagement_rate}%</td>
                          <td className="font-medium">{formatCurrency(content.revenue)}</td>
                          <td className="font-medium text-green-600">₹{contentRpm}</td>
                          <td>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(content.content_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`delete-content-${content.content_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No content records yet.</p>
                <p className="text-sm mt-1">Click "Add Content" to track your content performance!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default Analytics;
