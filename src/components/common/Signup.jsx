import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Signup.css';

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
// Signup Component
// ─────────────────────────────────────────────────────────────────────────────

const Signup = ({ onBack, onLoginClick, onSignupOTPNeeded, role, isAddMode = false }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    try {
      setLoading(true);

      if (isAddMode) {
        // User is already logged in via phone, just add email & password
        const { error } = await supabase.auth.updateUser({
          email,
          password,
          data: {
            full_name: fullName,
            role: role
          }
        });
        if (error) throw error;
        toast.success('Check your email for the verification code.');
      } else {
        // Normal new signup
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role
            },
            emailRedirectTo: 'com.xpool.app://callback'
          }
        });
        if (error) throw error;
        toast.success('Account created! Please check your email for the verification code.');
      }

      // Route to email OTP verification screen before proceeding
      if (onSignupOTPNeeded) {
        onSignupOTPNeeded(email);
      } else if (!isAddMode) {
        onLoginClick();
      }
    } catch (error) {
      console.error('[Signup error]', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="signup-grain" aria-hidden="true" />
      <div className="signup-dot-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="signup-header">
        <motion.button
          className="signup-back-btn"
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
        className="signup-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Title */}
        <motion.h1 className="signup-title" variants={itemVariants}>
          {isAddMode ? 'Add Email & Password' : 'Create your Account'}
        </motion.h1>
        
        <motion.p className="signup-subtitle" variants={itemVariants}>
          {isAddMode
            ? 'Finish setting up your account by providing an email.'
            : 'Enter your details to register a new account.'}
        </motion.p>

        {/* Input Form */}
        <motion.form
          className="signup-input-card"
          variants={itemVariants}
          onSubmit={handleSubmit}
        >
          <div className="signup-input-group">
            <label className="signup-input-label">Full Name</label>
            <div className="signup-input-wrapper">
              <User size={18} className="signup-input-icon" />
              <input
                type="text"
                placeholder="John Doe"
                className="signup-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

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
              />
            </div>
          </div>

          <div className="signup-input-group">
            <label className="signup-input-label">Password</label>
            <div className="signup-input-wrapper">
              <Lock size={18} className="signup-input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="signup-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="signup-input-group">
            <label className="signup-input-label">Confirm Password</label>
            <div className="signup-input-wrapper">
              <Lock size={18} className="signup-input-icon" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                className="signup-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </motion.form>

        {/* Bottom Section */}
        <motion.div className="signup-bottom-section" variants={itemVariants}>
          {!isAddMode && (
            <p className="signup-footer-text">
              Already have an account?{' '}
              <button type="button" className="signup-login-link" onClick={onLoginClick}>
                Sign in
              </button>
            </p>
          )}

          <motion.button
            type="button"
            className="signup-cta"
            disabled={loading || !email || !password || !fullName || password !== confirmPassword}
            whileHover={{ scale: (loading || !email || !password || password !== confirmPassword) ? 1 : 1.02 }}
            whileTap={{ scale: (loading || !email || !password || password !== confirmPassword) ? 1 : 0.97 }}
            onClick={handleSubmit}
          >
            <span>{loading ? 'Saving…' : (isAddMode ? 'Verify Email' : 'Sign Up')}</span>
            {!loading && <ArrowRight size={20} strokeWidth={2.5} />}
            {loading && <div className="signup-spinner" />}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;
