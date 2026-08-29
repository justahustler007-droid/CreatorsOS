import { motion } from 'framer-motion';
import { 
  Wallet, 
  Handshake, 
  BarChart3, 
  FileText, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Bell,
  Shield
} from 'lucide-react';
import { FireballLogo } from '../components/FireballLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Moon, Sun } from 'lucide-react';

const features = [
  {
    icon: Wallet,
    title: 'Unified Income Tracker',
    description: 'Track all revenue streams - brand deals, ad revenue, affiliates, and products in one place.'
  },
  {
    icon: Handshake,
    title: 'Brand Deal Manager',
    description: 'Manage collaborations, track deal status, and never miss a payment deadline.'
  },
  {
    icon: BarChart3,
    title: 'Content Analytics',
    description: 'Understand your revenue per content piece and identify your best performers.'
  },
  {
    icon: FileText,
    title: 'GST Invoice Generator',
    description: 'Create professional invoices with GST calculations and download as PDF.'
  },
  {
    icon: Bell,
    title: 'Payment Reminders',
    description: 'Get notified before payments are due. Never chase payments again.'
  },
  {
    icon: Sparkles,
    title: 'AI Pricing Suggestions',
    description: 'Get smart pricing recommendations based on your metrics and market rates.'
  }
];

const stats = [
  { value: '₹50L+', label: 'Revenue Tracked' },
  { value: '1000+', label: 'Deals Managed' },
  { value: '98%', label: 'On-time Payments' }
];

export const Landing = () => {
  const { login, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <FireballLogo size="md" />
              <span className="font-manrope font-bold text-xl">CreatorOS</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="landing-theme-toggle"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              {user ? (
                <Button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full px-6"
                  data-testid="go-dashboard-btn"
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  onClick={login}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full px-6"
                  data-testid="get-started-btn"
                >
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
                <TrendingUp className="h-4 w-4" />
                <span>Financial OS for Creators</span>
              </div>
              
              <h1 className="font-manrope text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
                Your CFO Dashboard,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-purple-600">
                  Built for Creators
                </span>
              </h1>
              
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-xl">
                Track income, manage brand deals, analyze content revenue, and generate GST invoices. 
                Everything you need to run your creator business like a pro.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={user ? () => window.location.href = '/dashboard' : login}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-full px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                  data-testid="hero-cta-btn"
                >
                  {user ? 'Open Dashboard' : 'Start Free'} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-8 py-6 text-lg"
                  data-testid="learn-more-btn"
                >
                  Learn More
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/7676469/pexels-photo-7676469.jpeg"
                  alt="Content creator working"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                
                {/* Floating Stats Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-6 left-6 right-6 glass rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    {stats.map((stat, index) => (
                      <div key={index} className="text-center">
                        <p className="font-manrope font-bold text-xl text-white">{stat.value}</p>
                        <p className="text-sm text-slate-300">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
              
              {/* Decorative Fireball */}
              <div className="absolute -top-6 -right-6 opacity-70">
                <FireballLogo size="xl" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything You Need to{' '}
              <span className="text-blue-600">Manage Your Finances</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Built specifically for content creators. Simple, powerful, and designed to help you grow.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="feature-card"
                  data-testid={`feature-card-${index}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-manrope font-semibold text-xl text-slate-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl bg-slate-900 dark:bg-slate-800 p-12 md:p-20 overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 opacity-20">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 blur-3xl" />
            </div>
            
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <div className="flex justify-center mb-6">
                <FireballLogo size="lg" animate />
              </div>
              <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Take Control of Your Creator Finances?
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Join thousands of creators who manage their business with CreatorOS. 
                Free to start, powerful to scale.
              </p>
              <Button
                onClick={user ? () => window.location.href = '/dashboard' : login}
                className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-8 py-6 text-lg font-semibold shadow-lg"
                data-testid="cta-get-started-btn"
              >
                {user ? 'Open Dashboard' : 'Get Started Free'} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <FireballLogo size="sm" animate={false} />
              <span className="font-manrope font-bold">CreatorOS</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Shield className="h-4 w-4" />
              <span>Your data is secure and private</span>
            </div>
            <p className="text-sm text-slate-500">
              © 2024 CreatorOS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
