import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './OTPVerification.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

<<<<<<< HEAD
const OTPVerification = ({ onBack, onVerify, phoneNumber, isSignupFlow = false, isAddMode = false }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
=======
// ─────────────────────────────────────────────────────────────────────────────
// Mesh background blobs (matches PhoneLogin / RoleSelection)
// ─────────────────────────────────────────────────────────────────────────────
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

const MESH_BLOBS = [
  { x: 10, y: 15, size: 220, opacity: 0.06 },
  { x: 80, y: 20, size: 280, opacity: 0.05 },
  { x: 25, y: 70, size: 200, opacity: 0.04 },
  { x: 70, y: 60, size: 240, opacity: 0.05 },
  { x: 90, y: 85, size: 180, opacity: 0.04 },
  { x: 50, y: 40, size: 300, opacity: 0.03 },
];

const MeshBackground = React.memo(() => (
  <div className="otp-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="otp-mesh-blob"
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
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// OTPVerification Component
// ─────────────────────────────────────────────────────────────────────────────

const OTPVerification = ({ onBack, onVerify, phoneNumber, isSignupFlow = false, isAddMode = false }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

<<<<<<< HEAD
    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            toast.error('Please enter the full 6-digit OTP.');
            return;
        }
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otpString,
                type: isAddMode ? 'phone_change' : 'sms'
            });
            if (error) throw error;
=======
  const invokeEdgeFunction = async (fnName, body) => {
    const { data: { session } } = await supabase.auth.getSession();
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

    if (session?.access_token) {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      return data;
    }

<<<<<<< HEAD
    const handleResendOtp = async () => {
        try {
            setResending(true);
            const { error } = await supabase.auth.resend({
                phone: phoneNumber,
                type: isAddMode ? 'phone_change' : 'sms',
            });
            if (error) throw error;
            toast.success('OTP resent successfully!');
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } catch (error) {
            console.error('[OTPVerification] Resend error:', error);
            toast.error(error.message || 'Failed to resend OTP.');
        } finally {
            setResending(false);
        }
    };
=======
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Edge function error (${res.status})`);
    return data;
  };

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value !== '' && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the full 6-digit OTP.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: otpString,
        type: isAddMode ? 'phone_change' : 'sms'
      });
      if (error) throw error;

      toast.success('Mobile number verified!');
      onVerify(otpString);
    } catch (error) {
      console.error('[OTPVerification] Verify error:', error);
      toast.error(error.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);
      const { error } = await supabase.auth.resend({
        phone: phoneNumber,
        type: isAddMode ? 'phone_change' : 'sms',
      });
      if (error) throw error;
      toast.success('OTP resent successfully!');
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (error) {
      console.error('[OTPVerification] Resend error:', error);
      toast.error(error.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  // Virtual Numeric Keypad handlers
  const handleKeypadClick = (num) => {
    const firstEmptyIndex = otp.findIndex(val => val === '');
    if (firstEmptyIndex !== -1) {
      handleChange(firstEmptyIndex, num.toString());
    }
  };

  const handleBackspace = () => {
    const lastFilledIndex = otp.map((val, i) => val !== '' ? i : -1).reduce((a, b) => Math.max(a, b), -1);
    if (lastFilledIndex !== -1) {
      const newOtp = [...otp];
      newOtp[lastFilledIndex] = '';
      setOtp(newOtp);
      inputRefs[lastFilledIndex].current?.focus();
    }
  };

  const maskedPhone = phoneNumber
    ? phoneNumber.replace(/(\+\d{2})(\d+)(\d{4})/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : '';

  return (
    <div className="otp-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="otp-grain" aria-hidden="true" />
      <div className="otp-dot-overlay" aria-hidden="true" />

      <div className="otp-top-section">
        {/* Header */}
        <header className="otp-header">
          <motion.button
            className="otp-back-btn"
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
          className="otp-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
        {/* Title & Subtitle */}
        <motion.h1 className="otp-title" variants={itemVariants}>
          {isSignupFlow ? 'Verify Mobile OTP' : 'Enter OTP'}
        </motion.h1>
        
        <motion.p className="otp-subtitle" variants={itemVariants}>
          Code sent to <span className="otp-highlight">{maskedPhone || phoneNumber}</span>
        </motion.p>

        {/* OTP Input Card */}
        <motion.div className="otp-input-card" variants={itemVariants}>
          <div className="otp-input-row">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength="1"
                className="otp-digit-box"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otp.join('').length === 6) {
                    handleVerify();
                  } else {
                    handleKeyDown(index, e);
                  }
                }}
                autoFocus={index === 0}
              />
            ))}
          </div>
        </motion.div>

        {/* Numeric Keypad Simulation */}
        <motion.div className="otp-keypad" variants={itemVariants}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className="otp-key"
              onClick={() => handleKeypadClick(num)}
            >
              {num}
            </button>
          ))}
          <div className="otp-key-spacer" />
          <button className="otp-key" onClick={() => handleKeypadClick(0)}>
            0
          </button>
          <button className="otp-key otp-key-backspace" onClick={handleBackspace}>
            ⌫
          </button>
        </motion.div>

        </motion.div>
      </div>

      {/* Bottom Section */}
      <motion.div className="otp-bottom-section" variants={itemVariants}>
          <div className="otp-resend-container">
            <span className="otp-resend-text">Didn't receive code?</span>
            <button
              className="otp-resend-btn"
              onClick={handleResendOtp}
              disabled={resending}
            >
              {resending ? <RefreshCw size={14} className="otp-spin-icon" /> : 'Resend'}
            </button>
          </div>

          <motion.button
            type="button"
            className="otp-cta"
            disabled={loading || otp.join('').length !== 6}
            whileHover={{ scale: (loading || otp.join('').length !== 6) ? 1 : 1.02 }}
            whileTap={{ scale: (loading || otp.join('').length !== 6) ? 1 : 0.97 }}
            onClick={handleVerify}
          >
            <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
            {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
            {loading && <div className="otp-spinner" />}
          </motion.button>
        </motion.div>
    </div>
  );
};

export default OTPVerification;
