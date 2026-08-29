import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Filter,
  Download
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

const SOURCES = [
  { value: 'brand_deal', label: 'Brand Deal' },
  { value: 'ad_revenue', label: 'Ad Revenue' },
  { value: 'affiliate', label: 'Affiliate' },
  { value: 'product', label: 'Product Sales' }
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'other', label: 'Other' }
];

export const Income = () => {
  const [incomeList, setIncomeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    source: '',
    platform: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const fetchIncome = async () => {
    try {
      const response = await axios.get(`${API}/income`, { withCredentials: true });
      setIncomeList(response.data);
    } catch (error) {
      console.error('Error fetching income:', error);
      toast.error('Failed to load income data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncome();
    // Auto-refresh whenever another module changes financial data
    // (e.g., a deal flips to "paid" and creates an auto-income entry).
    const onChanged = () => fetchIncome();
    window.addEventListener('creatoros:data-changed', onChanged);
    window.addEventListener('focus', onChanged);
    return () => {
      window.removeEventListener('creatoros:data-changed', onChanged);
      window.removeEventListener('focus', onChanged);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.source || !formData.platform || !formData.amount || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/income`, {
        ...formData,
        amount: parseFloat(formData.amount)
      }, { withCredentials: true });
      
      toast.success('Income added successfully');
      setDialogOpen(false);
      setFormData({
        source: '',
        platform: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchIncome();
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      console.error('Error adding income:', error);
      toast.error('Failed to add income');
    }
  };

  const handleDelete = async (incomeId) => {
    if (!window.confirm('Are you sure you want to delete this income record?')) return;

    // Optimistic — strip the row immediately so the UI feels instant
    const prev = incomeList;
    setIncomeList((arr) => arr.filter((i) => i.income_id !== incomeId));

    try {
      await axios.delete(`${API}/income/${incomeId}`, { withCredentials: true });
      toast.success('Income deleted');
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      setIncomeList(prev);   // rollback
      console.error('Error deleting income:', error);
      toast.error('Failed to delete income');
    }
  };

  // Calculate monthly data for chart
  const monthlyData = incomeList.reduce((acc, income) => {
    const month = format(new Date(income.date), 'MMM');
    const existing = acc.find(m => m.month === month);
    if (existing) {
      existing.amount += income.amount;
    } else {
      acc.push({ month, amount: income.amount });
    }
    return acc;
  }, []);

  // Calculate totals
  const totalIncome = incomeList.reduce((sum, i) => sum + i.amount, 0);
  const thisMonthIncome = incomeList.filter(i => {
    const incomeDate = new Date(i.date);
    const now = new Date();
    return incomeDate.getMonth() === now.getMonth() && incomeDate.getFullYear() === now.getFullYear();
  }).reduce((sum, i) => sum + i.amount, 0);

  const getSourceLabel = (value) => SOURCES.find(s => s.value === value)?.label || value;
  const getPlatformLabel = (value) => PLATFORMS.find(p => p.value === value)?.label || value;

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
              Income Tracker
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Track all your revenue streams in one place
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="add-income-btn">
                <Plus className="h-4 w-4" />
                Add Income
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-manrope">Add Income</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source *</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({...formData, source: value})}
                    >
                      <SelectTrigger data-testid="income-source-select">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map(source => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Platform *</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value) => setFormData({...formData, platform: value})}
                    >
                      <SelectTrigger data-testid="income-platform-select">
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
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      placeholder="50000"
                      data-testid="income-amount-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      data-testid="income-date-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Optional notes..."
                    data-testid="income-notes-input"
                  />
                </div>
                
                <Button type="submit" className="w-full" data-testid="submit-income-btn">
                  Add Income
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card data-testid="total-income-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="font-manrope text-3xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
            </CardContent>
          </Card>
          <Card data-testid="this-month-income-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="font-manrope text-3xl font-bold mt-1">{formatCurrency(thisMonthIncome)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Chart */}
        <Card data-testid="monthly-income-chart">
          <CardHeader>
            <CardTitle className="font-manrope">Monthly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Income Table */}
        <Card data-testid="income-table-card">
          <CardHeader>
            <CardTitle className="font-manrope">Income History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : incomeList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Source</th>
                      <th>Platform</th>
                      <th>Amount</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeList.map((income) => (
                      <tr key={income.income_id} data-testid={`income-row-${income.income_id}`}>
                        <td>{format(new Date(income.date), 'MMM d, yyyy')}</td>
                        <td>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">
                            {getSourceLabel(income.source)}
                          </span>
                        </td>
                        <td className="capitalize">{getPlatformLabel(income.platform)}</td>
                        <td className="font-medium">{formatCurrency(income.amount)}</td>
                        <td className="text-muted-foreground max-w-xs truncate">{income.notes || '-'}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(income.income_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-income-${income.income_id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No income records yet.</p>
                <p className="text-sm mt-1">Click "Add Income" to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default Income;
