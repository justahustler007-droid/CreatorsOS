import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Youtube, Instagram, Users, Tag, MapPin, FileText, ArrowRight } from 'lucide-react';
import { FireballLogo } from '../components/FireballLogo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

// localStorage keys — kept in one place so Dashboard / App can read the same names.
export const PROFILE_KEY = 'creatoros_profile';
export const ONBOARDING_DONE_KEY = 'creatoros_onboarding_complete';

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

export const Onboarding = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    creator_name: user?.name || '',
    bio: '',
    youtube_link: '',
    instagram_handle: '',
    follower_count: '',
    niche: '',
    address: '',
    gstin: ''
  });

  const handleSubmit = () => {
    if (!formData.creator_name) {
      toast.error('Please enter your creator name');
      return;
    }

    setLoading(true);

    // ── 100% client-side persistence (MVP). No backend POST.
    // ── Derived fields kept for parity with the old API response shape so
    // ── Dashboard / Settings / Brand Finder can read the same fields.
    const followers = parseInt(formData.follower_count) || 0;
    const detected_platform =
      formData.youtube_link && formData.instagram_handle ? 'both'
      : formData.youtube_link ? 'youtube'
      : formData.instagram_handle ? 'instagram'
      : null;

    const profile = {
      ...formData,
      follower_count: followers,
      detected_platform,
      email: user?.email || null,
      picture: user?.picture || null,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      toast.success('Profile created successfully!');
      setTimeout(() => {
        setLoading(false);
        onComplete();
      }, 300);
    } catch (err) {
      setLoading(false);
      console.error('Failed to save profile locally:', err);
      toast.error('Could not save profile. Storage may be full or blocked.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <Card>
          <CardContent className="pt-8 pb-6">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <FireballLogo size="lg" animate />
              </div>
              <h1 className="font-manrope text-2xl font-bold">Welcome to CreatorOS!</h1>
              <p className="text-muted-foreground mt-1">Let's set up your creator profile</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-16 rounded-full transition-colors ${
                    s <= step ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Creator Name *
                  </Label>
                  <Input
                    value={formData.creator_name}
                    onChange={(e) => setFormData({...formData, creator_name: e.target.value})}
                    placeholder="Your brand/creator name"
                    data-testid="onboarding-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Creator Niche
                  </Label>
                  <Select
                    value={formData.niche}
                    onValueChange={(value) => setFormData({...formData, niche: value})}
                  >
                    <SelectTrigger data-testid="onboarding-niche-select">
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

                <Button 
                  onClick={() => setStep(2)} 
                  className="w-full mt-4 gap-2"
                  data-testid="onboarding-next-1"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-500" />
                    YouTube Channel Link
                  </Label>
                  <Input
                    value={formData.youtube_link}
                    onChange={(e) => setFormData({...formData, youtube_link: e.target.value})}
                    placeholder="https://youtube.com/@yourchannel"
                    data-testid="onboarding-youtube-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram Handle
                  </Label>
                  <Input
                    value={formData.instagram_handle}
                    onChange={(e) => setFormData({...formData, instagram_handle: e.target.value})}
                    placeholder="@yourhandle"
                    data-testid="onboarding-instagram-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Followers/Subscribers
                  </Label>
                  <Input
                    type="number"
                    value={formData.follower_count}
                    onChange={(e) => setFormData({...formData, follower_count: e.target.value})}
                    placeholder="100000"
                    data-testid="onboarding-followers-input"
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} className="flex-1 gap-2" data-testid="onboarding-next-2">
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Optional: Add business details for GST invoicing
                </p>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Business Address
                  </Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Your business address for invoices"
                    data-testid="onboarding-address-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    GSTIN (if registered)
                  </Label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    data-testid="onboarding-gstin-input"
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="flex-1 gap-2"
                    data-testid="onboarding-complete"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>Complete Setup</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            <p className="text-xs text-center text-muted-foreground mt-6">
              You can update these details anytime in Settings
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Onboarding;
