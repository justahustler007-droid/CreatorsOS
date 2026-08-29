import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { 
  Plus, 
  Trash2, 
  Download,
  FileText,
  Eye
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Safe number helper - converts undefined/NaN to 0
const safeNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

// Safe currency formatting
const formatCurrency = (value) => {
  const safeVal = safeNumber(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(safeVal);
};

// Safe date formatting helper
const safeFormatDate = (dateStr, formatStr = 'dd/MM/yyyy') => {
  try {
    if (!dateStr) return format(new Date(), formatStr);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return format(new Date(), formatStr);
    return format(date, formatStr);
  } catch (e) {
    return format(new Date(), formatStr);
  }
};

// Safe string helper for jsPDF
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

// GST Rate options for India
const GST_RATES = [
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' }
];

export const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [formData, setFormData] = useState({
    creator_name: '',
    creator_address: '',
    creator_gstin: '',
    creator_state: '',
    client_name: '',
    client_address: '',
    client_gstin: '',
    client_state: '',
    description: '',
    sac_code: '998361',
    taxable_value: '',
    gst_rate: '18'
  });

  const fetchData = async () => {
    try {
      const [invoicesRes, profileRes] = await Promise.all([
        axios.get(`${API}/invoices`, { withCredentials: true }),
        axios.get(`${API}/profile`, { withCredentials: true })
      ]);
      setInvoices(invoicesRes.data || []);
      setProfile(profileRes.data);
      
      // Pre-fill creator details from profile
      if (profileRes.data) {
        setFormData(prev => ({
          ...prev,
          creator_name: profileRes.data.creator_name || '',
          creator_address: profileRes.data.address || '',
          creator_gstin: profileRes.data.gstin || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setInvoices([]);
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

  // Calculate GST breakdown
  const calculateGST = (taxableAmount, gstRate, isSameState) => {
    const taxable = safeNumber(taxableAmount);
    const rate = safeNumber(gstRate);
    const gstAmount = taxable * (rate / 100);
    
    if (isSameState) {
      // Intra-state: CGST + SGST (split equally)
      return {
        taxable_value: taxable,
        gst_rate: rate,
        cgst_rate: rate / 2,
        sgst_rate: rate / 2,
        igst_rate: 0,
        cgst_amount: gstAmount / 2,
        sgst_amount: gstAmount / 2,
        igst_amount: 0,
        total_tax: gstAmount,
        total_amount: taxable + gstAmount
      };
    } else {
      // Inter-state: IGST
      return {
        taxable_value: taxable,
        gst_rate: rate,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: rate,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: gstAmount,
        total_tax: gstAmount,
        total_amount: taxable + gstAmount
      };
    }
  };

  // Determine if same state (for CGST/SGST vs IGST)
  const isSameState = () => {
    // If either state is empty, default to same state (CGST+SGST)
    if (!formData.creator_state || !formData.client_state) {
      return true;
    }
    return formData.creator_state.toLowerCase() === formData.client_state.toLowerCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.creator_name || !formData.client_name || !formData.description || !formData.taxable_value) {
      toast.error('Please fill in all required fields');
      return;
    }

    const taxableValue = safeNumber(formData.taxable_value);
    if (taxableValue <= 0) {
      toast.error('Please enter a valid taxable amount');
      return;
    }

    try {
      const gstCalc = calculateGST(taxableValue, formData.gst_rate, isSameState());
      
      await axios.post(`${API}/invoices`, {
        creator_name: formData.creator_name,
        creator_address: formData.creator_address || '',
        creator_gstin: formData.creator_gstin || '',
        client_name: formData.client_name,
        client_address: formData.client_address || '',
        client_gstin: formData.client_gstin || '',
        description: formData.description,
        sac_code: formData.sac_code || '998361',
        taxable_value: gstCalc.taxable_value,
        is_igst: !isSameState(),
        gst_rate: gstCalc.gst_rate
      }, { withCredentials: true });
      
      toast.success('Invoice created successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      creator_name: profile?.creator_name || '',
      creator_address: profile?.address || '',
      creator_gstin: profile?.gstin || '',
      creator_state: '',
      client_name: '',
      client_address: '',
      client_gstin: '',
      client_state: '',
      description: '',
      sac_code: '998361',
      taxable_value: '',
      gst_rate: '18'
    });
  };

  const handleDelete = async (invoiceId) => {
    if (!window.confirm('Delete this invoice?')) return;

    // Optimistic UI
    const prev = invoices;
    setInvoices((arr) => arr.filter((i) => i.invoice_id !== invoiceId));

    try {
      await axios.delete(`${API}/invoices/${invoiceId}`, { withCredentials: true });
      toast.success('Invoice deleted');
      window.dispatchEvent(new Event('creatoros:data-changed'));
    } catch (error) {
      setInvoices(prev);   // rollback
      toast.error('Failed to delete invoice');
    }
  };

  const generatePDF = (invoice) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Safe values
      const invoiceId = safeString(invoice.invoice_id) || 'INV-000000-0000';
      const invoiceDate = safeFormatDate(invoice.invoice_date || invoice.created_at);
      const creatorName = safeString(invoice.creator_name) || 'Creator';
      const creatorAddress = safeString(invoice.creator_address);
      const creatorGstin = safeString(invoice.creator_gstin);
      const clientName = safeString(invoice.client_name) || 'Client';
      const clientAddress = safeString(invoice.client_address);
      const clientGstin = safeString(invoice.client_gstin);
      const description = safeString(invoice.description) || 'Services';
      const sacCode = safeString(invoice.sac_code) || '998361';
      
      const taxableValue = safeNumber(invoice.taxable_value);
      const cgstRate = safeNumber(invoice.cgst_rate);
      const sgstRate = safeNumber(invoice.sgst_rate);
      const igstRate = safeNumber(invoice.igst_rate);
      const cgstAmount = safeNumber(invoice.cgst_amount);
      const sgstAmount = safeNumber(invoice.sgst_amount);
      const igstAmount = safeNumber(invoice.igst_amount);
      const totalTax = safeNumber(invoice.total_tax);
      const totalAmount = safeNumber(invoice.total_amount);
      
      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX INVOICE', 20, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Invoice No: ' + invoiceId, 20, 35);
      doc.text('Date: ' + invoiceDate, pageWidth - 60, 35);
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      let y = 55;
      
      // Creator Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('From:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(creatorName, 20, y + 7);
      
      let creatorY = y + 7;
      if (creatorAddress) {
        const creatorAddrLines = doc.splitTextToSize(creatorAddress, 70);
        doc.text(creatorAddrLines, 20, creatorY + 7);
        creatorY += 7 + (creatorAddrLines.length * 5);
      }
      if (creatorGstin) {
        doc.text('GSTIN: ' + creatorGstin, 20, creatorY + 7);
      }
      
      // Client Details
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', 120, y);
      doc.setFont('helvetica', 'normal');
      doc.text(clientName, 120, y + 7);
      
      let clientY = y + 7;
      if (clientAddress) {
        const clientAddrLines = doc.splitTextToSize(clientAddress, 70);
        doc.text(clientAddrLines, 120, clientY + 7);
        clientY += 7 + (clientAddrLines.length * 5);
      }
      if (clientGstin) {
        doc.text('GSTIN: ' + clientGstin, 120, clientY + 7);
      }
      
      y = 100;
      
      // Line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageWidth - 20, y);
      
      y += 10;
      
      // Table Header
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y, pageWidth - 40, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Description', 25, y + 8);
      doc.text('SAC Code', 100, y + 8);
      doc.text('Amount', 155, y + 8);
      
      y += 18;
      
      // Description row
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(description, 70);
      doc.text(descLines, 25, y);
      doc.text(sacCode, 100, y);
      doc.text(formatCurrency(taxableValue), 155, y);
      
      y += Math.max(20, descLines.length * 5 + 10);
      
      // Line
      doc.line(20, y, pageWidth - 20, y);
      y += 10;
      
      // Tax Breakdown
      doc.setFontSize(10);
      
      doc.text('Taxable Value:', 120, y);
      doc.text(formatCurrency(taxableValue), 165, y);
      y += 8;
      
      if (igstAmount > 0) {
        doc.text('IGST @ ' + igstRate + '%:', 120, y);
        doc.text(formatCurrency(igstAmount), 165, y);
        y += 8;
      } else {
        doc.text('CGST @ ' + cgstRate + '%:', 120, y);
        doc.text(formatCurrency(cgstAmount), 165, y);
        y += 8;
        
        doc.text('SGST @ ' + sgstRate + '%:', 120, y);
        doc.text(formatCurrency(sgstAmount), 165, y);
        y += 8;
      }
      
      doc.text('Total Tax:', 120, y);
      doc.text(formatCurrency(totalTax), 165, y);
      y += 12;
      
      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TOTAL:', 120, y);
      doc.text(formatCurrency(totalAmount), 165, y);
      
      // Footer
      y = 250;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('This is a computer-generated invoice and does not require a signature.', 20, y);
      doc.text('Generated by CreatorOS', 20, y + 8);
      
      // Save
      doc.save(invoiceId + '.pdf');
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  // Calculate preview for form
  const calculatePreview = () => {
    return calculateGST(formData.taxable_value, formData.gst_rate, isSameState());
  };

  const preview = calculatePreview();

  // Calculate totals with safe numbers
  const totalInvoiced = (invoices || []).reduce((sum, i) => sum + safeNumber(i.total_amount), 0);
  const totalTax = (invoices || []).reduce((sum, i) => sum + safeNumber(i.total_tax), 0);

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
              GST Invoices
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Generate GST-compliant invoices for Indian businesses
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="create-invoice-btn">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-manrope">Create GST Invoice</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Creator Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">YOUR DETAILS (SUPPLIER)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Creator/Business Name *</Label>
                      <Input
                        value={formData.creator_name}
                        onChange={(e) => setFormData({...formData, creator_name: e.target.value})}
                        placeholder="Your business name"
                        data-testid="invoice-creator-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={formData.creator_state}
                        onChange={(e) => setFormData({...formData, creator_state: e.target.value})}
                        placeholder="e.g., Maharashtra"
                        data-testid="invoice-creator-state"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={formData.creator_address}
                      onChange={(e) => setFormData({...formData, creator_address: e.target.value})}
                      placeholder="Business address"
                      rows={2}
                      data-testid="invoice-creator-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input
                      value={formData.creator_gstin}
                      onChange={(e) => setFormData({...formData, creator_gstin: e.target.value.toUpperCase()})}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      data-testid="invoice-creator-gstin"
                    />
                  </div>
                </div>

                {/* Client Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">CLIENT DETAILS (RECIPIENT)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client/Brand Name *</Label>
                      <Input
                        value={formData.client_name}
                        onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                        placeholder="Client business name"
                        data-testid="invoice-client-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={formData.client_state}
                        onChange={(e) => setFormData({...formData, client_state: e.target.value})}
                        placeholder="e.g., Karnataka"
                        data-testid="invoice-client-state"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Client Address</Label>
                    <Textarea
                      value={formData.client_address}
                      onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                      placeholder="Client business address"
                      rows={2}
                      data-testid="invoice-client-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client GSTIN (optional)</Label>
                    <Input
                      value={formData.client_gstin}
                      onChange={(e) => setFormData({...formData, client_gstin: e.target.value.toUpperCase()})}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      data-testid="invoice-client-gstin"
                    />
                  </div>
                </div>

                {/* Service Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">SERVICE DETAILS</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Service Description *</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Content creation services for social media campaign..."
                        data-testid="invoice-description"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>SAC Code</Label>
                        <Input
                          value={formData.sac_code}
                          onChange={(e) => setFormData({...formData, sac_code: e.target.value})}
                          placeholder="998361"
                          data-testid="invoice-sac-code"
                        />
                        <p className="text-xs text-muted-foreground">998361 = Influencer Services</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Taxable Amount (₹) *</Label>
                        <Input
                          type="number"
                          value={formData.taxable_value}
                          onChange={(e) => setFormData({...formData, taxable_value: e.target.value})}
                          placeholder="50000"
                          min="0"
                          step="0.01"
                          data-testid="invoice-taxable-value"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>GST Rate</Label>
                        <Select
                          value={formData.gst_rate}
                          onValueChange={(value) => setFormData({...formData, gst_rate: value})}
                        >
                          <SelectTrigger data-testid="invoice-gst-rate">
                            <SelectValue placeholder="Select rate" />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map(rate => (
                              <SelectItem key={rate.value} value={rate.value}>
                                {rate.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Tax Type Indicator */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Tax Type: </span>
                        {isSameState() ? (
                          <span className="text-blue-600">CGST + SGST (Same State)</span>
                        ) : (
                          <span className="text-purple-600">IGST (Inter-State)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on supplier and client states. Leave states empty for same-state (CGST+SGST).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tax Preview */}
                {safeNumber(formData.taxable_value) > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm">Tax Breakdown Preview</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span>Taxable Value:</span>
                      <span className="text-right">{formatCurrency(preview.taxable_value)}</span>
                      
                      {preview.igst_amount > 0 ? (
                        <>
                          <span>IGST @ {preview.igst_rate}%:</span>
                          <span className="text-right">{formatCurrency(preview.igst_amount)}</span>
                        </>
                      ) : (
                        <>
                          <span>CGST @ {preview.cgst_rate}%:</span>
                          <span className="text-right">{formatCurrency(preview.cgst_amount)}</span>
                          <span>SGST @ {preview.sgst_rate}%:</span>
                          <span className="text-right">{formatCurrency(preview.sgst_amount)}</span>
                        </>
                      )}
                      
                      <span className="font-bold pt-2 border-t">Total:</span>
                      <span className="text-right font-bold pt-2 border-t">{formatCurrency(preview.total_amount)}</span>
                    </div>
                  </div>
                )}
                
                <Button type="submit" className="w-full" data-testid="submit-invoice-btn">
                  Create Invoice
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="total-invoiced-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoiced</p>
                  <p className="font-manrope text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="total-tax-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total GST</p>
                  <p className="font-manrope text-2xl font-bold">{formatCurrency(totalTax)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="invoice-count-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoices Created</p>
                  <p className="font-manrope text-2xl font-bold">{(invoices || []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card data-testid="invoices-table-card">
          <CardHeader>
            <CardTitle className="font-manrope">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (invoices || []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Taxable</th>
                      <th>Tax</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices || []).map((invoice) => (
                      <tr key={invoice.invoice_id} data-testid={`invoice-row-${invoice.invoice_id}`}>
                        <td className="font-mono text-sm">{safeString(invoice.invoice_id)}</td>
                        <td>{safeFormatDate(invoice.invoice_date || invoice.created_at)}</td>
                        <td className="font-medium">{safeString(invoice.client_name)}</td>
                        <td>{formatCurrency(invoice.taxable_value)}</td>
                        <td>{formatCurrency(invoice.total_tax)}</td>
                        <td className="font-bold">{formatCurrency(invoice.total_amount)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setPreviewInvoice(invoice); }}
                              data-testid={`preview-invoice-${invoice.invoice_id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); generatePDF(invoice); }}
                              data-testid={`download-invoice-${invoice.invoice_id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleDelete(invoice.invoice_id); }}
                              className="text-red-600"
                              data-testid={`delete-invoice-${invoice.invoice_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No invoices yet.</p>
                <p className="text-sm mt-1">Click "Create Invoice" to generate your first GST invoice!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Preview Dialog */}
        <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-manrope">Invoice Preview</DialogTitle>
            </DialogHeader>
            {previewInvoice && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border space-y-6">
                {/* Header */}
                <div className="border-b-2 border-slate-900 dark:border-white pb-4">
                  <h2 className="font-manrope text-2xl font-bold">TAX INVOICE</h2>
                  <div className="flex justify-between mt-2 text-sm">
                    <span>Invoice No: {safeString(previewInvoice.invoice_id)}</span>
                    <span>Date: {safeFormatDate(previewInvoice.invoice_date || previewInvoice.created_at)}</span>
                  </div>
                </div>
                
                {/* Parties */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">From</p>
                    <p className="font-medium">{safeString(previewInvoice.creator_name)}</p>
                    {previewInvoice.creator_address && <p className="text-sm">{previewInvoice.creator_address}</p>}
                    {previewInvoice.creator_gstin && <p className="text-sm">GSTIN: {previewInvoice.creator_gstin}</p>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Bill To</p>
                    <p className="font-medium">{safeString(previewInvoice.client_name)}</p>
                    {previewInvoice.client_address && <p className="text-sm">{previewInvoice.client_address}</p>}
                    {previewInvoice.client_gstin && <p className="text-sm">GSTIN: {previewInvoice.client_gstin}</p>}
                  </div>
                </div>
                
                {/* Items */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 p-3 grid grid-cols-3 text-sm font-medium">
                    <span>Description</span>
                    <span>SAC Code</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 text-sm">
                    <span>{safeString(previewInvoice.description)}</span>
                    <span>{safeString(previewInvoice.sac_code) || '998361'}</span>
                    <span className="text-right">{formatCurrency(previewInvoice.taxable_value)}</span>
                  </div>
                </div>
                
                {/* Tax Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>{formatCurrency(previewInvoice.taxable_value)}</span>
                  </div>
                  {safeNumber(previewInvoice.igst_amount) > 0 ? (
                    <div className="flex justify-between">
                      <span>IGST @ {safeNumber(previewInvoice.igst_rate)}%:</span>
                      <span>{formatCurrency(previewInvoice.igst_amount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>CGST @ {safeNumber(previewInvoice.cgst_rate)}%:</span>
                        <span>{formatCurrency(previewInvoice.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST @ {safeNumber(previewInvoice.sgst_rate)}%:</span>
                        <span>{formatCurrency(previewInvoice.sgst_amount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>{formatCurrency(previewInvoice.total_amount)}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => generatePDF(previewInvoice)} 
                  className="w-full gap-2"
                  data-testid="preview-download-btn"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
};

export default Invoices;
