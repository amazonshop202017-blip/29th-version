import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import authHero from '@/assets/auth-hero.png';

type Mode = 'login' | 'signup';

const Entering = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const { login, signup } = useAuth();

  const passwordChecks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'Contains a number', valid: /\d/.test(password) },
    { label: 'Contains uppercase', valid: /[A-Z]/.test(password) },
    { label: 'Contains special char', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!passwordChecks.every((c) => c.valid)) {
        setError('Password does not meet requirements');
        return;
      }
    }

    const result = mode === 'login' ? login(email, password) : signup(email, password);
    if (!result.success) {
      setError(result.error || 'Something went wrong');
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  return (
    <div className="min-h-screen w-full bg-background flex">
      {/* Left: Hero image */}
      <div className="hidden lg:block relative w-1/2 p-3">
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          <img
            src={authHero}
            alt="New York Stock Exchange trading floor"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark gradient for legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/80" />

          {/* Logo top-left */}
          <div className="absolute top-6 left-6 flex items-center gap-2 text-white">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8 L16 4 L28 8 L16 12 Z" fill="currentColor" opacity="0.95" />
              <path d="M4 16 L16 12 L28 16 L16 20 Z" fill="currentColor" opacity="0.7" />
              <path d="M4 24 L16 20 L28 24 L16 28 Z" fill="currentColor" opacity="0.45" />
            </svg>
            <span className="font-semibold text-lg tracking-tight">Tradeworkstation</span>
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Your complete trading workstation.
            </h2>
            <p className="text-sm text-white/80 max-w-md mb-5 leading-relaxed">
              Track your trades, analyze your performance, and master your psychology. All in one place.
            </p>
            <div className="flex flex-wrap gap-2">
              {['JOURNAL', 'ANALYTICS', 'PSYCHOLOGY', 'PERFORMANCE'].map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[10px] font-semibold tracking-wider"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  {mode === 'login' ? 'Welcome back' : 'Create an account'}
                </h1>
                <p className="text-sm text-muted-foreground mt-2 mb-8">
                  {mode === 'login'
                    ? 'Sign in to your account to continue'
                    : 'Start your trading journey today'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === 'signup' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">First name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="John"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="pl-10 h-11 bg-background"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Last name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Doe"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="pl-10 h-11 bg-background"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 bg-background"
                      />
                    </div>
                  </div>

                  {mode === 'signup' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-10 h-11 bg-background"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Confirm</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-10 pr-10 h-11 bg-background"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">Password</label>
                        <button
                          type="button"
                          className="text-xs font-medium text-foreground hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'signup' && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {passwordChecks.map((c) => (
                        <div key={c.label} className="flex items-center gap-1.5 text-xs">
                          {c.valid ? (
                            <Check className="w-3.5 h-3.5 text-[hsl(var(--profit))]" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span className={cn(c.valid ? 'text-foreground' : 'text-muted-foreground')}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {mode === 'login' && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={remember}
                        onCheckedChange={(v) => setRemember(!!v)}
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm text-muted-foreground cursor-pointer select-none"
                      >
                        Remember me for 30 days
                      </label>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-sm text-destructive"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    className="w-full h-11 group"
                    size="lg"
                  >
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>

                  {mode === 'signup' && (
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      By creating an account, you agree to our{' '}
                      <a href="#" className="text-foreground hover:underline">Terms of Service</a>{' '}
                      and{' '}
                      <a href="#" className="text-foreground hover:underline">Privacy Policy</a>
                    </p>
                  )}
                </form>

                {mode === 'login' && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-background px-3 text-muted-foreground">or continue with</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className="w-full h-11 opacity-60"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                  </>
                )}

                <p className="text-sm text-muted-foreground text-center mt-6">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-foreground font-medium hover:underline"
                  >
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default Entering;
