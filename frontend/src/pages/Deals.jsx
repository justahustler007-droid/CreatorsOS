import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Edit,
  GripVertical,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' }
];

const DELIVERABLE_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'reel', label: 'Reel' },
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' }
];

const STAGES = [
  { value: 'lead', label: 'Lead', color: 'bg-slate-100 dark:bg-slate-800' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'content_delivered', label: 'Content Delivered', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { value: 'payment_pending', label: 'Payment Pending', color: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 dark:bg-green-900/30' }
];

const getStageConfig = (stage) => STAGES.find(s => s.value === stage) || STAGES[0];

export const Deals = () => {
  const [pipeline, setPipeline] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [pricingSuggestion, setPricingSuggestion] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [formData, setFormData] = useState({
    brand_name: '',
    platform: '',
    deliverable_type: '',
    deal_value: '',
    stage: 'lead',
    payment_due_date: '',
    contract_url: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [pipelineRes, profileRes] = await Promise.all([
        axios.get(`${API}/deals/pipeline`, { withCredentials: true }),
        axios.get(`${API}/profile`, { withCredentials: true })
      ]);
      setPipeline(pipelineRes.data);
      setProfile(profileRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onChanged = () => fetchData();
    window.addEventListener('creatoros:data-changed', onChanged);
    window.addEventListener('focus', onChanged);
    return () => {
      window.removeEventListener('creatoros:data-changed', onChanged);
      window.removeEventListener('focus', onChanged);
    };
  }, []);

  const resetForm = () => {
    setFormData({
      brand_name: '',
      platform: '',
      deliverable_type: '',
      deal_value: '',
      stage: 'lead',
      payment_due_date: '',
      contract_url: '',
      notes: ''
    });
    setEditingDeal(null);
    setPricingSuggestion(null);
  };

  const handleOpenDialog = (deal = null) => {
    if (deal) {
      setEditingDeal(deal);
      setFormData({
        brand_name: deal.brand_name,
        platform: deal.platform,
        deliverable_type: deal.deliverable_type || 'video',
        deal_value: deal.deal_value.toString(),
        stage: deal.stage || 'lead',
        payment_due_date: deal.payment_due_date ? deal.payment_due_date.split('T')[0] : '',
        contract_url: deal.contract_url || '',
        notes: deal.notes || ''
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleGetPricingSuggestion = async () => {
    if (!formData.platform || !formData.deliverable_type) {
      toast.error('Select platform and deliverable type first');
      return;
    }

    setLoadingPricing(true);
    try {
      const response = await axios.post(`${API}/ai/pricing-suggestion`, {
        follower_count: profile?.follower_count || 10000,
        engagement_rate: 4.5,
        platform: formData.platform,
        content_type: formData.deliverable_type
      }, { withCredentials: true });
      
      setPricingSuggestion(response.data);
    } catch (error) {
      toast.error('Failed to get pricing suggestion');
    } finally {
      setLoadingPricing(false);
    }
  };

  const handleUseSuggestedPrice = () => {
    if (pricingSuggestion) {
      const avgPrice = Math.round((pricingSuggestion.min_price + pricingSuggestion.max_price) / 2);
      setFormData({...formData, deal_value: avgPrice.toString()});
      toast.success('Suggested price applied');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.brand_name || !formData.platform || !formData.deal_value || !formData.deliverable_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        ...formData,
        deal_value: parseFloat(formData.deal_value),
        payment_due_date: formData.payment_due_date || null
      };

      if (editingDeal) {
        await axios.put(`${API}/deals/${editingDeal.deal_id}`, payload, { withCredentials: true });
        toast.success('Deal updated successfully');
      } else {
        await axios.post(`${API}/deals`, payload, { withCredentials: true });
        toast.success('Deal added successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      toast.error('Failed to save deal');
    }
  };

  const handleStageChange = async (dealId, newStage) => {
    try {
      await axios.put(`${API}/deals/${dealId}/stage`, { stage: newStage }, { withCredentials: true });
      
      if (newStage === 'paid') {
        toast.success('Deal marked as paid! Revenue updated.');
      } else {
        toast.success('Stage updated');
      }
      fetchData();
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      toast.error('Failed to update stage');
    }
  };

  const handleDelete = async (dealId) => {
    if (!dealId) {
      toast.error('Invalid deal ID');
      return;
    }
    if (!window.confirm('Delete this deal?')) return;

    // Optimistic UI
    const prev = deals;
    setDeals((arr) => arr.filter((d) => d.deal_id !== dealId));

    try {
      const response = await axios.delete(`${API}/deals/${dealId}`, { withCredentials: true });
      if (response.status === 200) {
        toast.success('Deal deleted');
        window.dispatchEvent(new Event('creatoros:data-changed'));
      }
    } catch (error) {
      setDeals(prev);   // rollback
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete deal');
    }
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
              Deal Pipeline
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage your brand deals through the sales pipeline
            </p>
          </div>
          
          <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="add-deal-btn">
            <Plus className="h-4 w-4" />
            Add Deal
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((stage) => (
              <div 
                key={stage.value}
                className={`w-72 rounded-xl ${stage.color} p-4`}
                data-testid={`stage-${stage.value}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {pipeline[stage.value]?.length || 0}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {(pipeline[stage.value] || []).map((deal) => (
                    <Card 
                      key={deal.deal_id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      data-testid={`deal-card-${deal.deal_id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{deal.brand_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {deal.platform} • {deal.deliverable_type}
                            </p>
                          </div>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        
                        <p className="font-bold text-lg mb-3">{formatCurrency(deal.deal_value)}</p>
                        
                        {deal.payment_due_date && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Due: {format(new Date(deal.payment_due_date), 'MMM d, yyyy')}
                          </p>
                        )}

                        <div className="flex items-center gap-1">
                          <Select
                            value={deal.stage}
                            onValueChange={(value) => handleStageChange(deal.deal_id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleOpenDialog(deal); }}
                            data-testid={`edit-deal-${deal.deal_id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDelete(deal.deal_id); }}
                            data-testid={`delete-deal-${deal.deal_id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {(!pipeline[stage.value] || pipeline[stage.value].length === 0) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-manrope">
                {editingDeal ? 'Edit Deal' : 'Add New Deal'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <Input
                  value={formData.brand_name}
                  onChange={(e) => setFormData({...formData, brand_name: e.target.value})}
                  placeholder="Nike, Apple, etc."
                  data-testid="deal-brand-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform *</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value) => {
                      setFormData({...formData, platform: value});
                      setPricingSuggestion(null);
                    }}
                  >
                    <SelectTrigger data-testid="deal-platform-select">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deliverable Type *</Label>
                  <Select
                    value={formData.deliverable_type}
                    onValueChange={(value) => {
                      setFormData({...formData, deliverable_type: value});
                      setPricingSuggestion(null);
                    }}
                  >
                    <SelectTrigger data-testid="deal-deliverable-select">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERABLE_TYPES.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pricing Intelligence */}
              {formData.platform && formData.deliverable_type && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">AI Pricing</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGetPricingSuggestion}
                      disabled={loadingPricing}
                      data-testid="get-pricing-btn"
                    >
                      {loadingPricing ? 'Loading...' : 'Get Suggestion'}
                    </Button>
                  </div>
                  
                  {pricingSuggestion && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Suggested: <span className="font-semibold text-foreground">
                          {formatCurrency(pricingSuggestion.min_price)} – {formatCurrency(pricingSuggestion.max_price)}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleUseSuggestedPrice}
                        data-testid="use-suggested-price-btn"
                      >
                        Use Suggested Price
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deal Value (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.deal_value}
                    onChange={(e) => setFormData({...formData, deal_value: e.target.value})}
                    placeholder="50000"
                    data-testid="deal-value-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({...formData, stage: value})}
                  >
                    <SelectTrigger data-testid="deal-stage-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Payment Due Date</Label>
                <Input
                  type="date"
                  value={formData.payment_due_date}
                  onChange={(e) => setFormData({...formData, payment_due_date: e.target.value})}
                  data-testid="deal-due-date-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Deliverables, requirements, etc."
                  data-testid="deal-notes-input"
                />
              </div>
              
              <Button type="submit" className="w-full" data-testid="submit-deal-btn">
                {editingDeal ? 'Update Deal' : 'Add Deal'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
};

export default Deals;
