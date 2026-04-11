import React from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  ArrowLeft,
  ArrowRight,
  Shield,
  Zap,
} from 'lucide-react';
import './AuthSelection.css';
import logoReal from '../../assets/logo_real.jpg';

// ─────────────────────────────────────────────────────────────────────────────
// Mesh background blobs (same pattern as RoleSelection / Onboarding)
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
  <div className="as-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="as-mesh-blob"
        style={{
          left: `${blob.x}%`,
          top: `${blob.y}%`,
          width: blob.size,
          height: blob.size,
          background: `radial-gradient(circle, rgba(200,200,200,${blob.opacity}) 0%, rgba(180,180,180,${blob.opacity * 0.4}) 45%, transparent 70%)`,
          animationDuration: `${blob.dur}s`,
          animationDelay: `${blob.delay}s`,
        }}
      />
    ))}
  </div>
));
MeshBackground.displayName = 'MeshBackground';

// ─────────────────────────────────────────────────────────────────────────────
// Framer Motion variants (matching RoleSelection)
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

const featurePillVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// AuthSelection Component
// ─────────────────────────────────────────────────────────────────────────────

const AuthSelection = ({ onLogin, onSignup, onBack, onPhoneLogin }) => {
  return (
    <div className="as-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="as-grain" aria-hidden="true" />
      <div className="as-dot-overlay" aria-hidden="true" />

      <div className="as-top-section">
        {/* Header — matches RoleSelection */}
        <header className="as-header">
          <motion.button
            className="as-back-btn"
            onClick={onBack}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Go back"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </motion.button>
          <div className="as-logo-group">
            <img
              src={logoReal}
              alt="Xpool"
              className="as-logo-img"
              draggable={false}
            />
            <span className="as-brand">
              <span className="as-brand-x">X</span>pool
            </span>
          </div>
          <div className="as-header-spacer" /> {/* Spacer for grid */}
        </header>

      {/* Main content */}
      <motion.div
        className="as-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow */}
        <motion.div className="as-eyebrow-pill" variants={itemVariants}>
          <span className="as-eyebrow-dot" aria-hidden="true" />
          <span className="as-eyebrow-label">Welcome Back</span>
        </motion.div>

        {/* Title */}
        <motion.h1 className="as-title" variants={itemVariants}>
          Welcome to{' '}
          <span className="as-title-highlight">X</span>
          <span className="as-title-pool">pool</span>
        </motion.h1>



        {/* Feature Pills */}
        <div className="as-feature-pills">
          {[
            { icon: Shield, text: 'Secure Login' },
            { icon: Zap, text: 'Quick Access' },
          ].map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.span
                key={feat.text}
                className="as-feature-pill"
                custom={i}
                variants={featurePillVariants}
                initial="hidden"
                animate="visible"
              >
                <Icon size={14} strokeWidth={2.5} className="as-pill-icon" />
                {feat.text}
              </motion.span>
            );
          })}
        </div>

      </motion.div>
      </div>

      <motion.div
        className="as-bottom-section"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Auth Buttons */}
        <div className="as-buttons">
          {/* Phone Button — primary CTA */}
          <motion.button
            className="as-cta as-cta--phone"
            onClick={onPhoneLogin}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Continue with phone number"
          >
            <Phone size={20} strokeWidth={2.5} />
            <span>Continue with Phone Number</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </motion.button>

          {/* Divider */}
          <motion.div className="as-divider" variants={itemVariants}>
            <span className="as-divider-line" />
            <span className="as-divider-text">or</span>
            <span className="as-divider-line" />
          </motion.div>

          {/* Email Button — secondary CTA */}
          <motion.button
            className="as-cta as-cta--email"
            onClick={onLogin}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Continue with email"
          >
            <Mail size={20} strokeWidth={2.5} />
            <span>Continue with Email</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Footer */}
        <motion.p className="as-footer-note" variants={itemVariants}>
          By continuing you agree to our<br />
          <span className="as-footer-link">Terms of Service</span> &{' '}
          <span className="as-footer-link">Privacy Policy</span>
        </motion.p>
      </motion.div>
    </div>

  );
};

export default AuthSelection;
