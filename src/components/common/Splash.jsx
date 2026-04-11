import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '../../assets/logo_real.jpg';
import onboardingBottom from '../../assets/onboarding-bottom.png';
import './Splash.css';

const Splash = ({ onFinish, isReady }) => {
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minTimeElapsed && isReady) {
      console.log('[Splash] Timer elapsed and app ready. Finishing splash...');
      onFinish();
    }
  }, [minTimeElapsed, isReady, onFinish]);

  return (
    <div className="splash-premium-container">
      <div className="splash-ambient-blob blob-1"></div>
      <div className="splash-ambient-blob blob-2"></div>

      <div className="splash-content-layer">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="splash-brand-center"
        >
          <div className="splash-logo-glass">
            <img src={logo} alt="XPOOL Logo" className="splash-logo-img" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="splash-text-group"
          >
            <p className="splash-caption">India Moves On</p>
            <h1 className="splash-heading">
              <span className="text-amber">X</span>pool
            </h1>
            <p className="splash-tagline">Where Every Ride Counts</p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="splash-loader-area"
        >
          <div className="premium-loader"></div>
          <p className="loading-text">Getting things ready...</p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
        className="splash-city-footer"
      >
        <img src={onboardingBottom} alt="City Silhouette" className="city-silhouette-img" />
      </motion.div>
    </div>
  );
};

export default Splash;
