import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Car,
  ArrowRight,
  Check,
  Shield,
  Repeat,
} from 'lucide-react';
import './RoleSelection.css';
import logoReal from '../../assets/logo_real.jpg';

// ─────────────────────────────────────────────────────────────────────────────
// Mesh background blobs (same pattern as Onboarding)
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
  <div className="rs-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="rs-mesh-blob"
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
// Role config
// ─────────────────────────────────────────────────────────────────────────────

const roles = [
  {
    id: 'passenger',
    icon: User,
    title: "I'm a Passenger",
    desc: 'Find rides & share costs',
    iconClass: 'rs-card-icon--passenger',
  },
  {
    id: 'driver',
    icon: Car,
    title: "I'm a Driver",
    desc: 'Offer rides & earn money',
    iconClass: 'rs-card-icon--driver',
  },
];

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

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
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
// RoleSelection Component
// ─────────────────────────────────────────────────────────────────────────────

const RoleSelection = ({ onFinish }) => {
  const [selectedRole, setSelectedRole] = useState('passenger');

  const handleContinue = () => {
    onFinish(selectedRole);
  };

  return (
    <div className="rs-root">
      {/* Ambient background */}
      <MeshBackground />
      <div className="rs-grain" aria-hidden="true" />
      <div className="rs-dot-overlay" aria-hidden="true" />

      <div className="rs-top-section">
        {/* Header — matches Onboarding */}
        <header className="rs-header">
          <div className="rs-logo-group">
            <img
              src={logoReal}
              alt="Xpool"
              className="rs-logo-img"
              draggable={false}
            />
            <span className="rs-brand">
              <span className="rs-brand-x">X</span>pool
            </span>
          </div>
        </header>

      {/* Main content */}
      <motion.div
        className="rs-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow */}
        <motion.div className="rs-eyebrow-pill" variants={itemVariants}>
          <span className="rs-eyebrow-dot" aria-hidden="true" />
          <span className="rs-eyebrow-label">Choose Your Role</span>
        </motion.div>

        {/* Title */}
        <motion.h1 className="rs-title" variants={itemVariants}>
          How do you want to use{' '}
          <span className="rs-title-highlight">X</span>
          <span className="rs-title-pool">pool</span>?
        </motion.h1>



        {/* Feature Pills */}
        <div className="rs-feature-pills">
          {[
            { icon: Shield, text: 'Verified Users' },
            { icon: Repeat, text: 'Switch Anytime' },
          ].map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.span
                key={feat.text}
                className="rs-feature-pill"
                custom={i}
                variants={featurePillVariants}
                initial="hidden"
                animate="visible"
              >
                <Icon size={14} strokeWidth={2.5} className="rs-pill-icon" />
                {feat.text}
              </motion.span>
            );
          })}
        </div>

        {/* Role Cards */}
        <div className="rs-cards">
          {roles.map((role, i) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <motion.div
                key={role.id}
                className={`rs-card ${isSelected ? 'rs-card--selected' : ''}`}
                onClick={() => setSelectedRole(role.id)}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                role="radio"
                aria-checked={isSelected}
                aria-label={role.title}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRole(role.id);
                  }
                }}
              >
                <div className={`rs-card-icon ${role.iconClass}`}>
                  <Icon size={26} strokeWidth={2} />
                </div>
                <div className="rs-card-info">
                  <h3 className="rs-card-title">{role.title}</h3>
                  <p className="rs-card-desc">{role.desc}</p>
                </div>
                <div className="rs-card-check">
                  <AnimatePresence mode="wait">
                    {isSelected && (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <Check size={14} strokeWidth={3} className="rs-check-icon" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
      </div>

      {/* Bottom Section */}
      <motion.div
        className="rs-bottom-section"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* CTA Button */}
        <motion.button
          className="rs-cta"
          onClick={handleContinue}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          aria-label={`Continue as ${selectedRole}`}
        >
          <span>Continue</span>
          <ArrowRight size={20} strokeWidth={2.5} />
        </motion.button>

        {/* Footer */}
        <motion.p className="rs-footer-note" variants={itemVariants}>
          You can switch roles later through profile settings
        </motion.p>
      </motion.div>
    </div>
  );
};

export default RoleSelection;
