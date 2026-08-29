import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { 
  Sparkles, 
  Calculator,
  TrendingUp,
  User,
  Youtube,
  Instagram,
  Users,
  Tag,
  MapPin,
  FileText,
  Save
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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

const CONTENT_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'reel', label: 'Reel' },
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' }
];

const NICHES = [
  { value: 'tech', label: 'Tech & Gadgets' },
  { value: 'fashion', label: 'Fashion & Beauty' },
  { value: 'fitness', label: 'Fitness & Health' },
  { value: 'food', label: 'Food & Cooking' },
  { value: 'travel', label: 'Travel & Lifestyle' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'finance', label: 'Finance & Business' },
  { value: 'other', label: 'Other' }
];

export const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    creator_name: '',
    bio: '',
    youtube_link: '',
    instagram_handle: '',
    follower_count: '',
    niche: '',
    address: '',
    gstin: ''
  });
  
  const [pricingForm, setPricingForm] = useState({
    follower_count: '',
    engagement_rate: '',
    platform: '',
    content_type: ''
  });
  const [pricingSuggestion, setPricingSuggestion] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API}/profile`, { withCredentials: true });
        if (response.data) {
          setProfile(response.data);
          setProfileForm({
            creator_name: response.data.creator_name || '',
            bio: response.data.bio || '',
            youtube_link: response.data.youtube_link || '',
            instagram_handle: response.data.instagram_handle || '',
            follower_count: response.data.follower_count?.toString() || '',
            niche: response.data.niche || '',
            address: response.data.address || '',
            gstin: response.data.gstin || ''
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!profileForm.creator_name) {
      toast.error('Creator name is required');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/profile`, {
        ...profileForm,
        follower_count: parseInt(profileForm.follower_count) || 0
      }, { withCredentials: true });
      
      toast.success('Profile updated successfully!');
      setProfile({...profile, ...profileForm});
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleGetPricing = async (e) => {
    e.preventDefault();
    
    if (!pricingForm.follower_count || !pricingForm.engagement_rate || !pricingForm.platform || !pricingForm.content_type) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoadingPricing(true);
    setPricingSuggestion(null);

    try {
      const response = await axios.post(`${API}/ai/pricing-suggestion`, {
        follower_count: parseInt(pricingForm.follower_count),
        engagement_rate: parseFloat(pricingForm.engagement_rate),
        platform: pricingForm.platform,
        content_type: pricingForm.content_type
      }, { withCredentials: true });
      
      setPricingSuggestion(response.data);
    } catch (error) {
      toast.error('Failed to get pricing suggestion');
    } finally {
      setLoadingPricing(false);
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
        className="space-y-6 max-w-4xl"
      >
        {/* Header */}
        <div>
          <h1 className="font-manrope text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your profile and preferences
          </p>
        </div>

        {/* Profile Editing Card */}
        <Card data-testid="profile-edit-card">
          <CardHeader>
            <CardTitle className="font-manrope flex items-center gap-2">
              <User className="h-5 w-5" />
              Creator Profile
            </CardTitle>
            <CardDescription>Update your creator information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Creator Name *
                </Label>
                <Input
                  value={profileForm.creator_name}
                  onChange={(e) => setProfileForm({...profileForm, creator_name: e.target.value})}
                  placeholder="Your brand/creator name"
                  data-testid="settings-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Niche
                </Label>
                <Select
                  value={profileForm.niche}
                  onValueChange={(value) => setProfileForm({...profileForm, niche: value})}
                >
                  <SelectTrigger data-testid="settings-niche-select">
                    <SelectValue placeholder="Select your niche" />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHES.map(niche => (
                      <SelectItem key={niche.value} value={niche.value}>
                        {niche.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                placeholder="Tell brands about yourself..."
                rows={3}
                data-testid="settings-bio-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-500" />
                  YouTube Channel Link
                </Label>
                <Input
                  value={profileForm.youtube_link}
                  onChange={(e) => setProfileForm({...profileForm, youtube_link: e.target.value})}
                  placeholder="https://youtube.com/@yourchannel"
                  data-testid="settings-youtube-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  Instagram Handle
                </Label>
                <Input
                  value={profileForm.instagram_handle}
                  onChange={(e) => setProfileForm({...profileForm, instagram_handle: e.target.value})}
                  placeholder="@yourhandle"
                  data-testid="settings-instagram-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Followers/Subscribers
                </Label>
                <Input
                  type="number"
                  value={profileForm.follower_count}
                  onChange={(e) => setProfileForm({...profileForm, follower_count: e.target.value})}
                  placeholder="100000"
                  data-testid="settings-followers-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  GSTIN (for invoicing)
                </Label>
                <Input
                  value={profileForm.gstin}
                  onChange={(e) => setProfileForm({...profileForm, gstin: e.target.value.toUpperCase()})}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  data-testid="settings-gstin-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Business Address
              </Label>
              <Textarea
                value={profileForm.address}
                onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                placeholder="Your business address for invoices"
                rows={2}
                data-testid="settings-address-input"
              />
            </div>

            <Button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full md:w-auto gap-2"
              data-testid="save-profile-btn"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card data-testid="appearance-card">
          <CardHeader>
            <CardTitle className="font-manrope">Appearance</CardTitle>
            <CardDescription>Customize how CreatorOS looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                data-testid="dark-mode-switch"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Pricing Suggestion Card */}
        <Card data-testid="pricing-suggestion-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-manrope">Smart Deal Pricing</CardTitle>
                <CardDescription>Get AI-powered pricing suggestions for brand deals</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGetPricing} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Follower Count</Label>
                  <Input
                    type="number"
                    value={pricingForm.follower_count}
                    onChange={(e) => setPricingForm({...pricingForm, follower_count: e.target.value})}
                    placeholder="100000"
                    data-testid="pricing-followers-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Engagement Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pricingForm.engagement_rate}
                    onChange={(e) => setPricingForm({...pricingForm, engagement_rate: e.target.value})}
                    placeholder="4.5"
                    data-testid="pricing-engagement-input"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    value={pricingForm.platform}
                    onValueChange={(value) => setPricingForm({...pricingForm, platform: value})}
                  >
                    <SelectTrigger data-testid="pricing-platform-select">
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
                  <Label>Content Type</Label>
                  <Select
                    value={pricingForm.content_type}
                    onValueChange={(value) => setPricingForm({...pricingForm, content_type: value})}
                  >
                    <SelectTrigger data-testid="pricing-content-select">
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
              
              <Button 
                type="submit" 
                className="w-full gap-2"
                disabled={loadingPricing}
                data-testid="get-pricing-btn"
              >
                {loadingPricing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    Get Pricing Suggestion
                  </>
                )}
              </Button>
            </form>
            
            {pricingSuggestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl"
                data-testid="pricing-result"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-600">Recommended Price Range</span>
                </div>
                
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Minimum</p>
                    <p className="font-manrope text-2xl font-bold text-green-600">
                      {formatCurrency(pricingSuggestion.min_price)}
                    </p>
                  </div>
                  <div className="text-2xl text-muted-foreground">—</div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Maximum</p>
                    <p className="font-manrope text-2xl font-bold text-blue-600">
                      {formatCurrency(pricingSuggestion.max_price)}
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground text-center">
                  {pricingSuggestion.reasoning}
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Account Card */}
        <Card data-testid="account-card">
          <CardHeader>
            <CardTitle className="font-manrope">Account</CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              {user?.picture && (
                <img 
                  src={user.picture} 
                  alt={user.name}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-lg">{user?.name}</p>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            
            <Button 
              variant="destructive" 
              onClick={logout}
              data-testid="settings-logout-btn"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
};

export default Settings;
