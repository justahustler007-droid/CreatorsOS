import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, Check, ArrowRight } from 'lucide-react';
import { FireballLogo } from '../components/FireballLogo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const features = [
  "Unified Income Tracker",
  "Brand Deal Pipeline",
  "GST Invoice Generator",
  "AI Pricing Intelligence",
  "Payment Reminders",
  "Content Analytics"
];

export const Paywall = ({ onAccessGranted }) => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyCode = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const code = accessCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter an access code');
      return;
    }

    setLoading(true);

    // ── Frontend-only verification ─────────────────────────────────────
    // The backend is optional in production. We verify locally first so the
    // app works on static hosts (Vercel/Netlify) even when the FastAPI
    // backend is unreachable. If a backend is available, we still try to
    // sync the flag for cross-device persistence — but a failed sync does
    // NOT block the user.
    if (code === 'FIRST100') {
      localStorage.setItem('creatoros_early_access', 'true');
      try {
        await axios.post(
          `${API}/auth/verify-access-code`,
          { code },
          { withCredentials: true, timeout: 4000 }
        );
      } catch (_) {
        // ignore — local grant is sufficient
      }
      toast.success('Early access granted! Welcome to CreatorOS Pro.');
      setLoading(false);
      onAccessGranted();
      return;
    }

    setLoading(false);
    toast.error('Invalid access code');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="grid md:grid-cols-2 gap-8">
          {/* Pro Plan Card */}
          <Card className="relative overflow-hidden border-2 border-blue-500">
            <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
              PRO
            </div>
            <CardContent className="pt-8 pb-6">
              <div className="flex items-center gap-3 mb-6">
                <FireballLogo size="lg" animate />
                <div>
                  <h1 className="font-manrope text-2xl font-bold">CreatorOS Pro</h1>
                  <p className="text-muted-foreground text-sm">Built for creators managing brand deals and income</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-manrope">₹159</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full rounded-full py-6 text-lg gap-2" 
                disabled
                data-testid="start-trial-btn"
              >
                <Sparkles className="h-5 w-5" />
                Start 30 Day Free Trial
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Payment integration coming soon
              </p>
            </CardContent>
          </Card>

          {/* Early Access Card */}
          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-8 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-manrope text-xl font-bold">Early Creator Program</h2>
                  <p className="text-sm text-muted-foreground">First 100 creators get full access</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 mb-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Have an early access code? Enter it below to unlock all features for free.
                </p>
                
                <form onSubmit={handleVerifyCode} className="space-y-3">
                  <Input
                    placeholder="Enter Access Code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="text-center text-lg font-mono uppercase tracking-wider"
                    data-testid="access-code-input"
                    autoFocus
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full gap-2"
                    variant="outline"
                    data-testid="verify-code-btn"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    ) : (
                      <>
                        Unlock Access <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Don't have a code? Follow us on social media for giveaways!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
};

export default Paywall;
