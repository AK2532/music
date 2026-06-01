import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Headphones, Mail, Lock, Eye, EyeOff, User, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabase';
import { BrandLogo } from '../components/BrandLogo';
import { Capacitor } from '@capacitor/core';

// Shared Icons
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.73h5.51c-.18 1.16-.92 2.33-2.12 3.14v2.58h3.36c1.97-1.81 3.14-4.52 3.14-7.44 0-.47-.04-.92-.12-1.37z" />
    <path fill="#34A853" d="M12.18 20.37c2.58 0 4.75-.86 6.33-2.31l-3.36-2.58c-.85.57-1.94.92-3.09.92-2.4 0-4.43-1.61-5.16-3.79H3.45v2.66c1.58 3.14 4.79 5.25 8.73 5.25z" />
    <path fill="#FBBC05" d="M7.02 12.61c-.19-.57-.3-1.18-.3-1.81s.11-1.24.3-1.81V6.33H3.45C2.7 7.82 2.27 9.49 2.27 11.25s.43 3.43 1.18 4.92l3.57-2.76z" />
    <path fill="#EA4335" d="M12.18 4.63c1.41 0 2.67.48 3.66 1.43l2.75-2.75C16.92 1.77 14.76.88 12.18.88 8.24.88 5.03 2.99 3.45 6.13l3.57 2.66c.73-2.18 2.76-3.79 5.16-3.79z" />
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="currentColor" d="M16.365 9.907c-.015-1.785 1.455-2.651 1.523-2.695-1.127-1.65-3.013-1.884-3.662-1.921-1.424-.145-2.793.844-3.523.844-.73 0-1.867-.822-3.056-.799-1.547.022-2.977.904-3.769 2.285-1.61 2.802-.413 6.945 1.161 9.227.766 1.111 1.671 2.348 2.87 2.302 1.15-.045 1.59-.747 2.987-.747 1.397 0 1.79.747 2.987.724 1.243-.023 2.012-1.109 2.772-2.235.882-1.282 1.247-2.527 1.264-2.593-.027-.013-2.434-.94-2.45-3.327l-.104-.065zM14.654 4.881c.628-.763 1.053-1.821.938-2.881-.884.036-2.023.593-2.673 1.353-.522.6-1.025 1.687-.893 2.715.992.077 2.001-.424 2.628-1.187z" />
  </svg>
);

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

const introStats = [
  { label: 'Live search', value: 'YT Music' },
  { label: 'Offline', value: 'Ready' },
  { label: 'Theme', value: 'Adaptive' },
];

const InputField = ({ icon: Icon, type, placeholder, value, onChange, isPassword, showPassword, setShowPassword, autoComplete }) => (
  <div className="auth-field">
    <div className="auth-field__icon">
      <Icon size={18} />
    </div>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required
      autoComplete={autoComplete}
      className="auth-input auth-input--icon"
    />
    {isPassword && (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="auth-field__action"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    )}
  </div>
);

export default function Welcome({ initialMode = 'landing' }) {
  // Use initialMode directly for initial state, avoid syncing it in useEffect if possible, but since props might change, we'll keep a key on the component in App.jsx or just use derived state if needed. But for simple prop change sync:
  const [view, setView] = useState(initialMode); // 'landing', 'login', 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDevLogin = () => {
    window.localStorage.setItem('dev_user', 'true');
    window.location.reload();
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (view === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name }
          }
        });
        if (error) throw error;
        // Optionally auto-login or show success message here
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  // Sync prop changes safely by using a ref or just setting it if different, though standard React patterns suggest deriving it or keying the component.
  // Here we just use an effect but ensure it only runs when needed. 
  // A cleaner way is using `key={authView}` on `<Welcome />` in App.jsx. For now, this is acceptable if we bypass the strict lint rule or use a different pattern.
  // Actually, we can just use `key` in App.jsx. Let's remove the useEffect and let App.jsx handle the remount via key.
  
  // Removed useEffect hooks for syncing initialMode to avoid cascading renders.

  return (
    <div className="auth-shell auth-shell--welcome">
      <div className="app-background" aria-hidden="true">
        <div className="auth-sweep auth-sweep--one" />
        <div className="auth-sweep auth-sweep--two" />
        <div className="auth-grid" />
      </div>

      <div className="auth-layout">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div
              key="landing"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="auth-landing"
            >
              <motion.section variants={staggerContainer} initial="initial" animate="animate" className="auth-hero">
                <motion.div variants={fadeUp} className="auth-brandline">
                  <BrandLogo size={54} showWordmark />
                </motion.div>

                <motion.div variants={fadeUp} className="auth-kicker">
                  <Sparkles size={16} />
                  Immersive music dashboard
                </motion.div>

                <motion.h1 variants={fadeUp} className="auth-title">
                  Your music, tuned for the moment.
                </motion.h1>

                <motion.p variants={fadeUp} className="auth-subtitle">
                  Search, stream, save, and shape the player around your style from one focused app.
                </motion.p>

                <motion.div variants={fadeUp} className="auth-visual" aria-hidden="true">
                  <div className="auth-disc">
                    <div className="auth-disc__ring" />
                    <Headphones size={42} />
                  </div>
                  <div className="auth-now">
                    <div>
                      <span>Now staging</span>
                      <strong>Deep Focus Mix</strong>
                    </div>
                    <div className="auth-bars">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </motion.div>
              </motion.section>

              <motion.aside variants={staggerContainer} initial="initial" animate="animate" className="auth-card auth-card--landing glass-shimmer">
                <motion.div variants={fadeUp} className="auth-card__header">
                  <div className="label-mono">Start listening</div>
                  <h2 className="auth-card__title">Step into A.K Music</h2>
                  <p className="auth-card__subtitle">Use an account to keep your profile, or continue as a guest.</p>
                </motion.div>

                <motion.div variants={fadeUp} className="auth-stat-grid">
                  {introStats.map((item) => (
                    <div className="auth-stat" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </motion.div>

                <motion.button
                  variants={fadeUp}
                  onClick={() => setView('signup')}
                  className="button-primary auth-wide-button"
                >
                  Get Started <ArrowRight size={20} />
                </motion.button>
                
                <motion.button
                  variants={fadeUp}
                  onClick={() => setView('login')}
                  className="button-secondary auth-wide-button"
                >
                  I already have an account
                </motion.button>

                {Capacitor.isNativePlatform() && (
                  <motion.button
                    variants={fadeUp}
                    onClick={handleDevLogin}
                    className="button-secondary auth-wide-button"
                    style={{ border: '1px dashed var(--accent)', color: 'var(--accent)', marginTop: '8px' }}
                  >
                    Continue as Guest
                  </motion.button>
                )}

              </motion.aside>
            </motion.div>
          )}

          {(view === 'login' || view === 'signup') && (
            <motion.div
              key="auth"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="auth-focus"
            >
              <div className="auth-card auth-card--form">
                <button
                  onClick={() => setView('landing')}
                  className="auth-back-button"
                  aria-label="Back to intro"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="auth-card__header auth-card__header--center">
                  <BrandLogo size={52} />
                  <div className="label-mono">{view === 'login' ? 'Welcome back' : 'Create profile'}</div>
                  <h2 className="auth-card__title">
                    {view === 'login' ? 'Sign in to your sound.' : 'Build your listening space.'}
                  </h2>
                  <p className="auth-card__subtitle">
                    {view === 'login' ? 'Enter your details to restore your library and preferences.' : 'Create an account to keep your profile, theme, and playback setup.'}
                  </p>
                </div>
                <form onSubmit={handleEmailAuth} className="auth-form">
                  {view === 'signup' && (
                    <InputField
                      icon={User}
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  )}
                  
                  <InputField
                    icon={Mail}
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  
                  <InputField
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isPassword
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  />

                  {error && (
                    <div className="form-error auth-error">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="button-primary auth-wide-button auth-submit"
                  >
                    {isLoading ? (
                      <span className="auth-spinner" />
                    ) : (
                      view === 'login' ? 'Sign In' : 'Sign Up'
                    )}
                  </button>
                </form>

                <button
                  onClick={() => setView(view === 'login' ? 'signup' : 'login')}
                  className="auth-link-button"
                >
                  {view === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
