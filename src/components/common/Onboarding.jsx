import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Zap,
  Repeat,
  CircleDollarSign,
  ShieldCheck,
  Gem,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './Onboarding.css';

import onboarding1 from '../../assets/onboarding1.png';
import onboarding2 from '../../assets/onboarding2.png';
import onboarding3 from '../../assets/onboarding3.png';
import logoReal from '../../assets/logo_real.jpg';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const slides = [
  {
    id: 1,
    image: onboarding1,
    titleParts: [
      { text: 'Find rides ', highlight: false },
      { text: 'instantly', highlight: true }
    ],
    description: 'Search & book shared rides near you in seconds. Real-time availability at your fingertips.',
    eyebrow: 'Smart Matching',
    features: [
      { icon: MapPin, text: 'Live Tracking' },
      { icon: Zap, text: 'Instant Match' },
    ],
  },
  {
    id: 2,
    image: onboarding2,
    titleParts: [
      { text: 'Be a ', highlight: false },
      { text: 'driver', highlight: true },
      { text: ' or ', highlight: false },
      { text: 'passenger', highlight: true }
    ],
    description: 'Switch between roles anytime. Earn while you commute or sit back and enjoy the ride.',
    eyebrow: 'Dual Mode',
    features: [
      { icon: Repeat, text: 'Switch Roles' },
      { icon: CircleDollarSign, text: 'Earn Money' },
    ],
  },
  {
    id: 3,
    image: onboarding3,
    titleParts: [
      { text: 'Save ', highlight: false },
      { text: 'time', highlight: true },
      { text: ' & ', highlight: false },
      { text: 'money', highlight: true }
    ],
    description: 'Pool smarter, travel better. Transparent pricing with no hidden fees — guaranteed.',
    eyebrow: 'Best Value',
    features: [
      { icon: ShieldCheck, text: 'Verified Drivers' },
      { icon: Gem, text: 'Best Prices' },
    ],
  },
];

const AUTO_ADVANCE_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// Animated mesh blobs (ambient background)
// ─────────────────────────────────────────────────────────────────────────────

const MESH_BLOBS = [
  { x: 10, y: 15, size: 220, delay: 0, dur: 5, opacity: 0.18 },
  { x: 80, y: 20, size: 280, delay: 1.5, dur: 6, opacity: 0.14 },
  { x: 25, y: 70, size: 200, delay: 0.8, dur: 7, opacity: 0.12 },
  { x: 70, y: 60, size: 240, delay: 2.5, dur: 5.5, opacity: 0.16 },
  { x: 90, y: 85, size: 180, delay: 1, dur: 6.5, opacity: 0.1 },
  { x: 50, y: 40, size: 300, delay: 3, dur: 4.5, opacity: 0.08 },
];

const MeshBackground = React.memo(() => (
  <div className="ob-mesh-bg" aria-hidden="true">
    {MESH_BLOBS.map((blob, i) => (
      <div
        key={i}
        className="ob-mesh-blob"
        style={{
          left: `${blob.x}%`,
          top: `${blob.y}%`,
          width: blob.size,
          height: blob.size,
          background: `radial-gradient(circle, rgba(251,191,36,${blob.opacity}) 0%, rgba(245,158,11,${blob.opacity * 0.4}) 45%, transparent 70%)`,
          animationDuration: `${blob.dur}s`,
          animationDelay: `${blob.delay}s`,
        }}
      />
    ))}
  </div>
));
MeshBackground.displayName = 'MeshBackground';

// ─────────────────────────────────────────────────────────────────────────────
// Framer motion variants
// ─────────────────────────────────────────────────────────────────────────────

const imageVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const contentVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 },
  },
  exit: (dir) => ({
    x: dir > 0 ? -50 : 50,
    opacity: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

const featurePillVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.9 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.35 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Onboarding Component
// ─────────────────────────────────────────────────────────────────────────────

const Onboarding = ({ onFinish }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const autoAdvanceRef = useRef(null);

  const minSwipeDistance = 50;
  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];
  const progressPercent = ((currentSlide + 1) / slides.length) * 100;

  // ── Navigation ──────────────────────────────────────────────────────────

  const goTo = useCallback((idx, dir = 1) => {
    if (idx < 0 || idx >= slides.length || idx === currentSlide) return;
    setDirection(dir);
    setCurrentSlide(idx);
  }, [currentSlide]);

  const handleNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      goTo(currentSlide + 1, 1);
    }
  }, [currentSlide, goTo]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      goTo(currentSlide - 1, -1);
    }
  }, [currentSlide, goTo]);

  // ── Auto-advance timer ──────────────────────────────────────────────────

  useEffect(() => {
    if (isPaused || isLastSlide) return;
    autoAdvanceRef.current = setTimeout(handleNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(autoAdvanceRef.current);
  }, [currentSlide, isPaused, isLastSlide, handleNext]);

  // ── Touch Handling ──────────────────────────────────────────────────────

  const onTouchStart = useCallback((e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e) => {
    touchEnd.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > minSwipeDistance) handleNext();
    else if (distance < -minSwipeDistance) handlePrev();
  }, [handleNext, handlePrev]);

  // ── Keyboard ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === 'Enter' && isLastSlide) {
        onFinish();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleNext, handlePrev, isLastSlide, onFinish]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="ob-root"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient Background */}
      <MeshBackground />
      <div className="ob-grain" aria-hidden="true" />
      <div className="ob-dot-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="ob-header">
        <div className="ob-logo-group">
          <img
            src={logoReal}
            alt="Xpool"
            className="ob-logo-img"
            draggable={false}
          />
          <span className="ob-brand">
            <span className="ob-brand-x">X</span>pool
          </span>
        </div>
      </header>

      {/* Floating Skip Button */}
      {!isLastSlide && (
        <button
          className="ob-skip-btn"
          onClick={onFinish}
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      )}

      {/* ─── Main Split Layout ────────────────────────────────────── */}
      <div className="ob-split">

        {/* Left: Illustration Panel */}
        <div className="ob-panel-left">
          <div className="ob-illustration-glow" aria-hidden="true" />
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`img-${slide.id}`}
              className="ob-image-wrapper"
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <img
                src={slide.image}
                alt=""
                className="ob-slide-image"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          {/* Floating stat cards (desktop only) */}
          <div className="ob-float-cards">
            {slide.features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={`float-${slide.id}-${i}`}
                  className="ob-float-card"
                  initial={{ opacity: 0, y: 20, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="ob-float-card-icon">
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                  <span className="ob-float-card-text">{feat.text}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: Content Panel */}
        <div className="ob-panel-right">
          <div className="ob-content-glass">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`content-${slide.id}`}
                className="ob-content-inner"
                custom={direction}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Eyebrow */}
                <div className="ob-eyebrow-pill">
                  <span className="ob-eyebrow-dot" aria-hidden="true" />
                  <span className="ob-eyebrow-label">{slide.eyebrow}</span>
                </div>

                {/* Title */}
                <h1 className="ob-title">
                  {slide.titleParts.map((part, index) => (
                    <span
                      key={index}
                      className={part.highlight ? 'ob-title-highlight' : ''}
                    >
                      {part.text}
                    </span>
                  ))}
                </h1>

                {/* Description */}
                <p className="ob-description">{slide.description}</p>

                {/* Feature Pills (mobile) */}
                <div className="ob-feature-row">
                  {slide.features.map((feat, i) => {
                    const Icon = feat.icon;
                    return (
                      <motion.span
                        key={`pill-${slide.id}-${i}`}
                        className="ob-feature-pill"
                        custom={i}
                        variants={featurePillVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <Icon size={14} strokeWidth={2.5} className="ob-pill-icon" />
                        {feat.text}
                      </motion.span>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── Navigation Controls ── */}
            <div className="ob-nav-section">
              {/* Dots + Arrows */}
              <div className="ob-nav-row">
                <button
                  className="ob-arrow-btn"
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>

                <div className="ob-dots" role="tablist" aria-label="Slide navigation">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      role="tab"
                      aria-selected={currentSlide === index}
                      aria-label={`Go to slide ${index + 1}`}
                      className={`ob-dot ${currentSlide === index ? 'ob-dot--active' : ''}`}
                      onClick={() => goTo(index, index > currentSlide ? 1 : -1)}
                    />
                  ))}
                </div>

                <button
                  className="ob-arrow-btn"
                  onClick={handleNext}
                  disabled={isLastSlide}
                  aria-label="Next slide"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* CTA */}
              <AnimatePresence mode="wait">
                {isLastSlide && (
                  <motion.button
                    className="ob-cta-primary"
                    onClick={onFinish}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Get started with Xpool"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={20} strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Keyboard hint (desktop) */}
              <p className="ob-keyboard-hint">
                Use <kbd>←</kbd> <kbd>→</kbd> arrow keys to navigate
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
