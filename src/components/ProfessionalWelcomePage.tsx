import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Mail, Lock, UserPlus, LogIn, Key } from 'lucide-react';

interface ProfessionalWelcomePageProps {
  onLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
}

export function ProfessionalWelcomePage({ onLogin, onEmailLogin, onEmailSignUp, onPasswordReset }: ProfessionalWelcomePageProps) {
  const [view, setView] = useState<'welcome' | 'email-login' | 'email-signup' | 'reset-pass'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (view === 'email-login') {
        await onEmailLogin(email, password);
      } else if (view === 'email-signup') {
        await onEmailSignUp(email, password);
      } else if (view === 'reset-pass') {
        await onPasswordReset(email);
        setView('email-login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white font-sans selection:bg-emerald-500/30 overflow-hidden px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl p-8 md:p-12 bg-neutral-900 rounded-3xl border border-white/10 shadow-2xl space-y-8"
      >
        <div className="flex justify-center flex-col items-center space-y-4">
            <div className="p-4 bg-emerald-500/10 rounded-2xl">
                <Sparkles className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter">AI Resume Optimizer</h1>
              <p className="text-lg text-neutral-400 mt-2">Precision and speed for your career narrative.</p>
            </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'welcome' ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 text-emerald-500" />
                      <span className="text-sm font-medium">Securely Synced</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                      <Zap className="w-6 h-6 text-emerald-500" />
                      <span className="text-sm font-medium">Lightning Optimized</span>
                  </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onLogin}
                  className="w-full py-4 rounded-xl bg-white text-black text-lg font-bold transition-all hover:bg-neutral-200 flex items-center justify-center gap-2"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
                  Continue with Google
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">Or continue with Email</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setView('email-login')}
                    className="py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold transition-all border border-white/10 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" /> Log In
                  </button>
                  <button
                    onClick={() => setView('email-signup')}
                    className="py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-sm font-semibold transition-all border border-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> Sign Up
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="auth-form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {view === 'email-login' && <><LogIn className="w-5 h-5 text-emerald-500" /> Welcome Back</>}
                {view === 'email-signup' && <><UserPlus className="w-5 h-5 text-emerald-500" /> Create Account</>}
                {view === 'reset-pass' && <><Key className="w-5 h-5 text-emerald-500" /> Reset Password</>}
              </h2>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-500 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    />
                  </div>
                </div>

                {view !== 'reset-pass' && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-neutral-500 ml-1">Password</label>
                      {view === 'email-login' && (
                        <button 
                          type="button" 
                          onClick={() => setView('reset-pass')}
                          className="text-xs text-emerald-500 hover:text-emerald-400"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Processing...' : (
                    view === 'email-login' ? 'Login' :
                    view === 'email-signup' ? 'Create Account' :
                    'Send Reset Link'
                  )}
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setView('welcome')}
                  className="w-full py-2 text-sm text-neutral-500 hover:text-white transition-colors"
                >
                  Back to options
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
