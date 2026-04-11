import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, Shield, Zap, Fingerprint, LogIn } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Login.css';

// ─────────────────────────────────────────────────────────────────────────────
// Mesh background blobs
// ─────────────────────────────────────────────────────────────────────────────

const MESH_BLOBS = [
  { x: 10, y: 15, size: 220, opacity: 0.06 },
  { x: 80, y: 20, size: 280, opacity: 0.05 },
  { x: 25, y: 70, size: 200, opacity: 0.04 },
  { x: 70, y: 60, size: 240, opacity: 0.05 },
  { x: 90, y: 85, size: 180, opacity: 0.04 },
  { x: 50, y: 40, size: 300, opacity: 0.03 },
];

const MeshBackground = React.memo(() => (
  <div className="login-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="login-mesh-blob"
        style={{
          left: `${blob.x}%`,
          top: `${blob.y}%`,
          width: blob.size,
          height: blob.size,
          background: `radial-gradient(circle, rgba(200,200,200,${blob.opacity}) 0%, rgba(180,180,180,${blob.opacity * 0.4}) 45%, transparent 70%)`,
        }}
      />
    ))}
  </div>
));
MeshBackground.displayName = 'MeshBackground';

// ─────────────────────────────────────────────────────────────────────────────
// Framer Motion variants
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const pillVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.9 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.3 + i * 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Trust badges
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_PILLS = [
  { icon: Shield, label: 'Encrypted' },
  { icon: Lock, label: 'Secure Access' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Login Component
// ─────────────────────────────────────────────────────────────────────────────

const Login = ({ onBack, onSignupClick, onLoginSuccess, role }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailRef = useRef(null);

  // Auto-focus email input on mount
  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Manually save session specifically for WebView manual restoration
      if (data?.session) {
        console.log('[Login] Checkpoint: Saving manual session bundle to localStorage');
        const sessionBundle = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        };
        localStorage.setItem('xpool_manual_token', JSON.stringify(sessionBundle));
      }

      toast.success('Login successful!');

      if (onLoginSuccess) {
        try {
          await onLoginSuccess();
        } catch (callbackError) {
          console.error('Error in onLoginSuccess:', callbackError);
          toast.error('Navigation failed. Please try again.');
        }
      }

    } catch (error) {
      console.error('[Login Error]', error);
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
        toast.error('Network Error: Check internet, ad-blockers, or VPN.');
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email.includes('@') && password.length >= 6;

  return (
    <div className="login-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="login-grain" aria-hidden="true" />
      <div className="login-dot-overlay" aria-hidden="true" />

      <div className="login-top-section">
        {/* Header */}
        <header className="login-header">
          <motion.button
            className="login-back-btn"
            onClick={onBack}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Go back"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </motion.button>
        </header>

        {/* Main content */}
        <motion.div
          className="login-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Icon */}
          <motion.div className="login-hero-icon" variants={itemVariants}>
            <div className="login-hero-icon-inner">
              <LogIn size={28} strokeWidth={2} />
            </div>
            <div className="login-hero-icon-ring" />
          </motion.div>

          {/* Title */}
          <motion.h1 className="login-title" variants={itemVariants}>
            Log In{' '}
            {role && (
              <span className="login-title-role">
                as {role === 'driver' ? 'Driver' : 'Passenger'}
              </span>
            )}
          </motion.h1>

          <motion.p className="login-subtitle-text" variants={itemVariants}>
            Enter your credentials to securely access your account
          </motion.p>

          {/* Input Card */}
          <motion.form
            className="login-input-card"
            variants={itemVariants}
            onSubmit={handleSubmit}
          >
            <div className="login-input-group">
              <label className="login-input-label">Email Address</label>
              <div className={`login-input-row ${emailFocused ? 'login-focused' : ''} ${email.includes('@') && email.includes('.') ? 'login-valid' : ''}`}>
                <div className="login-icon-box">
                  <Mail size={18} strokeWidth={2.5} />
                </div>
                <div className="login-input-divider" />
                <div className="login-input-wrapper">
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="name@example.com"
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                  />
                </div>
                <AnimatePresence>
                  {email.includes('@') && email.includes('.') && (
                    <motion.div
                      className="login-input-check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-input-label">Password</label>
              <div className={`login-input-row ${passwordFocused ? 'login-focused' : ''}`}>
                <div className="login-icon-box">
                  <Lock size={18} strokeWidth={2.5} />
                </div>
                <div className="login-input-divider" />
                <div className="login-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </motion.form>

          {/* Trust badges */}
          <div className="login-trust-row">
            {TRUST_PILLS.map((pill, i) => (
              <motion.div
                key={pill.label}
                className="login-trust-pill"
                custom={i}
                variants={pillVariants}
                initial="hidden"
                animate="visible"
              >
                <pill.icon size={13} strokeWidth={2.5} />
                <span>{pill.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="login-bottom-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        {/* Security Note */}
        <div className="login-security-note">
          <Shield size={13} strokeWidth={2.5} />
          <span>Your login is encrypted and protected by standard protocols</span>
        </div>

        <p className="login-footer-text">
          Don't have an account?{' '}
          <button type="button" className="login-signup-link" onClick={onSignupClick}>
            Sign up
          </button>
        </p>

        <motion.button
          type="button"
          className={`login-cta ${isFormValid ? 'login-cta-ready' : ''}`}
          disabled={loading || !email || !password}
          whileHover={{ scale: (loading || !email || !password) ? 1 : 1.02 }}
          whileTap={{ scale: (loading || !email || !password) ? 1 : 0.97 }}
          onClick={handleSubmit}
        >
          <span>{loading ? 'Verifying…' : 'Secure Sign In'}</span>
          {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
          {loading && <div className="login-spinner" />}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default Login;
