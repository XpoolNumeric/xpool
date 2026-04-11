import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Shield,
  Lock,
  Zap,
  Fingerprint,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './PhoneLogin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Mesh background blobs (same pattern as RoleSelection / AuthSelection)
// ─────────────────────────────────────────────────────────────────────────────

const MESH_BLOBS = [
  { x: 10, y: 15, size: 220, delay: 0, dur: 5, opacity: 0.06 },
  { x: 80, y: 20, size: 280, delay: 1.5, dur: 6, opacity: 0.05 },
  { x: 25, y: 70, size: 200, delay: 0.8, dur: 7, opacity: 0.04 },
  { x: 70, y: 60, size: 240, delay: 2.5, dur: 5.5, opacity: 0.05 },
  { x: 90, y: 85, size: 180, delay: 1, dur: 6.5, opacity: 0.04 },
  { x: 50, y: 40, size: 300, delay: 3, dur: 4.5, opacity: 0.03 },
];

const MeshBackground = React.memo(() => (
  <div className="pl-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="pl-mesh-blob"
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
// Trust/Feature badges
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_PILLS = [
  { icon: Shield, label: 'Encrypted' },
  { icon: Zap, label: 'Instant OTP' },
  { icon: Fingerprint, label: 'Secure Login' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility: format phone number as user types (e.g. 98765 43210)
// ─────────────────────────────────────────────────────────────────────────────

const formatPhoneDisplay = (digits) => {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// PhoneLogin Component
// ─────────────────────────────────────────────────────────────────────────────

const PhoneLogin = ({ onBack, onProceed, isSignupFlow = false, isAddMode = false, role }) => {
  const [rawDigits, setRawDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const digitCount = rawDigits.length;
  const isValid = digitCount === 10;

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const invokeEdgeFunction = async (fnName, body) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      return data;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Edge function error (${res.status})`);
    return data;
  };

  const handlePhoneChange = (e) => {
    // Strip all non-digits, cap at 10
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRawDigits(digits);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (digitCount < 10) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }

    const formatted = `+91${rawDigits}`;

    try {
      setLoading(true);

      if (isAddMode) {
        const { error } = await supabase.auth.updateUser({ phone: formatted });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
        if (error) throw error;
      }

      toast.success('OTP sent to your mobile number!');
      onProceed(formatted);
    } catch (error) {
      console.error('[PhoneLogin] OTP send error:', error);
      toast.error(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic title based on flow
  const getTitle = () => {
    if (isAddMode) return 'Add Your Phone';
    return 'Verify Your Number';
  };

  return (
    <div className="pl-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="pl-grain" aria-hidden="true" />
      <div className="pl-dot-overlay" aria-hidden="true" />

      <div className="pl-top-section">
        {/* Header */}
        <header className="pl-header">
          <motion.button
            className="pl-back-btn"
            onClick={onBack}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Go back"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </motion.button>

          {/* Step indicator */}
          <div className="pl-step-badge">
            <Phone size={14} strokeWidth={2.5} />
            <span>Step 1 of 2</span>
          </div>
        </header>

        {/* Main content */}
        <motion.div
          className="pl-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Phone icon circle */}
          <motion.div className="pl-hero-icon" variants={itemVariants}>
            <div className="pl-hero-icon-inner">
              <Phone size={28} strokeWidth={2} />
            </div>
            <div className="pl-hero-icon-ring" />
          </motion.div>

          {/* Title */}
          <motion.h1 className="pl-title" variants={itemVariants}>
            {getTitle()}{' '}
            {role && (
              <span className="pl-title-role">
                as {role === 'driver' ? 'Driver' : 'Passenger'}
              </span>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p className="pl-subtitle-text" variants={itemVariants}>
            We'll send you a one-time password to verify your identity
          </motion.p>

          {/* Phone Input Section */}
          <motion.div className="pl-input-card" variants={itemVariants}>
            <label className="pl-input-label">Mobile Number</label>
            <div className={`pl-input-row ${isFocused ? 'pl-focused' : ''} ${isValid ? 'pl-valid' : ''}`}>
              <div className="pl-country-code">
                <span className="pl-flag">🇮🇳</span>
                <span className="pl-code">+91</span>
              </div>
              <div className="pl-input-divider" />
              <div className="pl-input-field-wrapper">
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  className="pl-input"
                  value={formatPhoneDisplay(rawDigits)}
                  onChange={handlePhoneChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  required
                  maxLength={11} /* 10 digits + 1 space */
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(e);
                  }}
                />
              </div>
              {/* Checkmark on valid */}
              <AnimatePresence>
                {isValid && (
                  <motion.div
                    className="pl-input-check"
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

          </motion.div>

          {/* Trust badges */}
          <div className="pl-trust-row">
            {TRUST_PILLS.map((pill, i) => (
              <motion.div
                key={pill.label}
                className="pl-trust-pill"
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

      {/* Bottom Section */}
      <motion.div
        className="pl-bottom-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        {/* Security note */}
        <div className="pl-security-note">
          <Lock size={13} strokeWidth={2.5} />
          <span>Your number is encrypted and never shared with third parties</span>
        </div>

        <p className="pl-footer-note">
          By clicking Continue, you agree to our <span className="pl-footer-link">T&Cs</span>
        </p>
        
        <motion.button
          type="button"
          className={`pl-cta ${isValid ? 'pl-cta-ready' : ''}`}
          disabled={loading || !isValid}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={handleSubmit}
        >
          <span>{loading ? 'Sending OTP…' : 'Send OTP'}</span>
          {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
          {loading && <div className="pl-spinner" />}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default PhoneLogin;
