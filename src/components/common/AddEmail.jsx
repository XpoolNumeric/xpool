import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './OTPVerification.css'; // Let's reuse the OTP css styling where applicable!
import './Signup.css';          // And Signup css mapping for structure wrappers

// This component uses dynamic CSS classes defined across both Signup.css and OTPVerification.css, 
// ensuring we don't have to duplicate the same brand tokens for a 2-step AddEmail flow.
// We'll map the structural classes to keep exact consistency.

const MESH_BLOBS = [
  { x: 10, y: 15, size: 220, opacity: 0.06 },
  { x: 80, y: 20, size: 280, opacity: 0.05 },
  { x: 25, y: 70, size: 200, opacity: 0.04 },
];

const MeshBackground = React.memo(() => (
  <div className="signup-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="signup-mesh-blob"
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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

const AddEmail = ({ onComplete, onBack }) => {
  const [step, setStep] = useState('input');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const handleSendOTP = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        email: trimmed
      });
      
      if (error) throw error;

      toast.success('Verification code sent to your email!');
      setStep('verify');
    } catch (error) {
      console.error('[AddEmail Error]', error);
      toast.error(error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit !== '' && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the full 6-digit code.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpString,
        type: 'email_change'
      });

      if (error) {
        console.warn('email_change verification failed, trying regular email verification', error);
        const { error: fallbackError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpString,
          type: 'email'
        });
        if (fallbackError) throw fallbackError || error;
      }

      toast.success('Email verified successfully!');
      await onComplete();
    } catch (error) {
      console.error('[AddEmail Verify Error]', error);
      toast.error(error.message || 'Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-root">
      <MeshBackground />
      <div className="signup-grain" aria-hidden="true" />
      <div className="signup-dot-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="signup-header">
        <motion.button
          className="signup-back-btn"
          onClick={step === 'verify' ? () => setStep('input') : onBack}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </motion.button>
      </header>

      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div
            key="input-step"
            className="signup-content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            <motion.h1 className="signup-title" variants={itemVariants}>
              Add Email Address
            </motion.h1>
            <motion.p className="signup-subtitle" variants={itemVariants}>
              Please link an email address to secure your account and receive ride receipts.
            </motion.p>

            <motion.form
              className="signup-input-card"
              variants={itemVariants}
              onSubmit={handleSendOTP}
            >
              <div className="signup-input-group">
                <label className="signup-input-label">Email Address</label>
                <div className="signup-input-wrapper">
                  <Mail size={18} className="signup-input-icon" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    className="signup-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
            </motion.form>

            <motion.div className="signup-bottom-section" variants={itemVariants}>
              <motion.button
                type="submit"
                className="signup-cta"
                disabled={loading || !email.includes('@')}
                whileHover={{ scale: (loading || !email.includes('@')) ? 1 : 1.02 }}
                whileTap={{ scale: (loading || !email.includes('@')) ? 1 : 0.97 }}
                onClick={handleSendOTP}
              >
                <span>{loading ? 'Sending Code…' : 'Send Verification Code'}</span>
                {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
                {loading && <div className="signup-spinner" />}
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="verify-step"
            className="signup-content"
            variants={containerVariants}
            initial={{ opacity: 0, y: 20 }}
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
          >
            <motion.h1 className="signup-title" variants={itemVariants}>
              Verify Email Address
            </motion.h1>
            <motion.p className="signup-subtitle" variants={itemVariants}>
              Code sent to <span style={{ color: 'var(--su-gray-900)', fontWeight: 600 }}>{email}</span>
            </motion.p>

            {/* OTP Input Card */}
            <motion.div className="otp-input-card" variants={itemVariants} style={{ marginBottom: 0 }}>
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
                        handleVerifyOTP();
                      } else {
                        handleKeyDown(index, e);
                      }
                    }}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div className="signup-bottom-section" variants={itemVariants} style={{ paddingTop: '24px' }}>
              <motion.button
                type="button"
                className="signup-cta"
                disabled={loading || otp.join('').length !== 6}
                whileHover={{ scale: (loading || otp.join('').length !== 6) ? 1 : 1.02 }}
                whileTap={{ scale: (loading || otp.join('').length !== 6) ? 1 : 0.97 }}
                onClick={handleVerifyOTP}
              >
                <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
                {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
                {loading && <div className="signup-spinner" />}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddEmail;
