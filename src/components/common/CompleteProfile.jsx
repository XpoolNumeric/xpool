import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Mail, Lock, Key, ArrowRight, Eye, EyeOff, ShieldCheck, Calendar, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './CompleteProfile.css';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

const checkmarkVariants = {
  hidden: { scale: 0, opacity: 0, rotate: -45 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 500, damping: 18 },
  },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
};

const CompleteProfile = ({ onBack, onComplete, phoneNumber, userRole: selectedRole }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('Male'); // Default 'Male'
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Real-time Field Validations ───────────────────────────────────────
  const isNameValid = fullName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isGenderValid = Boolean(gender);
  const isAgeValid = Boolean(age && !isNaN(age) && Number(age) >= 18 && Number(age) <= 100);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = Boolean(confirmPassword && confirmPassword === password && isPasswordValid);

  // Calculate completion percentage (6 total fields)
  const validFieldsCount = [
    isNameValid,
    isEmailValid,
    isGenderValid,
    isAgeValid,
    isPasswordValid,
    isConfirmPasswordValid,
  ].filter(Boolean).length;

  const progressPercentage = Math.round((validFieldsCount / 6) * 100);

  // ── Password Strength Calculation ─────────────────────────────────────
  const getPasswordStrength = () => {
    if (!password) return { label: '', percent: 0, color: '#e2e8f0' };
    if (password.length < 6) return { label: 'Weak', percent: 33, color: '#ef4444' };
    
    const hasNumberOrSymbol = /[0-9!@#$%^&*()]/.test(password);
    const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);

    if (password.length >= 8 && (hasNumberOrSymbol || hasMixedCase)) {
      return { label: 'Strong', percent: 100, color: '#10b981' };
    }
    return { label: 'Good', percent: 66, color: '#f59e0b' };
  };

  const pwStrength = getPasswordStrength();

  const validateForm = () => {
    const newErrors = {};

    if (!isNameValid) {
      newErrors.fullName = 'Full Name is required (at least 2 characters)';
    }

    if (!isEmailValid) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!isAgeValid) {
      newErrors.age = 'Age must be a number between 18 and 100';
    }

    if (!isPasswordValid) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (!isConfirmPasswordValid) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors before continuing.');
      return;
    }

    setLoading(true);

    try {
      // Get current authenticated session
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.user) {
        throw new Error('Authentication session expired. Please verify your phone again.');
      }

      const userId = session.user.id;
      const roleToUse = selectedRole || localStorage.getItem('userRole') || 'passenger';
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const userPhone = phoneNumber || session.user.phone || '';

      // 1. Update Supabase Auth Credentials (Password + Email + Metadata)
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password: password,
        email: cleanEmail,
        data: {
          full_name: cleanName,
          gender: gender,
          age: Number(age),
          role: roleToUse
        }
      });

      if (authUpdateError) {
        console.warn('[CompleteProfile] auth.updateUser warning:', authUpdateError.message);
      } else {
        await supabase.auth.refreshSession().catch(() => {});
      }

      // 2. Upsert Profiles Table with fallback if schema cache is missing gender/age columns
      const profilePayload = {
        id: userId,
        full_name: cleanName,
        email: cleanEmail,
        phone: userPhone,
        auth_provider: 'phone',
        role: roleToUse,
        user_role: roleToUse,
        updated_at: new Date().toISOString()
      };

      if (gender) profilePayload.gender = gender;
      if (age) profilePayload.age = Number(age);

      let { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload);

      // Fallback if DB table does not have 'gender' or 'age' columns yet
      if (profileError && (profileError.message?.includes('schema cache') || profileError.code === 'PGRST204')) {
        console.warn('[CompleteProfile] DB schema missing gender/age columns, retrying without optional fields...');
        delete profilePayload.gender;
        delete profilePayload.age;
        const retryResult = await supabase.from('profiles').upsert(profilePayload);
        profileError = retryResult.error;
      }

      if (profileError) {
        console.error('[CompleteProfile] Profiles upsert error:', profileError);
        throw new Error(profileError.message || 'Failed to save user profile.');
      }

      // 3. Upsert User Roles Table
      try {
        const { error: userRoleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            current_role: roleToUse,
            is_driver: roleToUse === 'driver',
            driver_status: roleToUse === 'driver' ? 'pending' : 'approved',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (userRoleError) {
          console.warn('[CompleteProfile] user_roles upsert warning:', userRoleError.message);
        }
      } catch (roleException) {
        console.warn('[CompleteProfile] user_roles exception:', roleException);
      }

      // Save role in localStorage
      localStorage.setItem('userRole', roleToUse);

      toast.success('Profile completed successfully! Welcome to Xpool.');
      if (onComplete) {
        await onComplete(roleToUse);
      }

    } catch (err) {
      console.error('[CompleteProfile] Exception:', err);
      toast.error(err.message || 'An error occurred while saving your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-root">
      {/* Light dot overlay */}
      <div className="cp-dot-overlay" />

      <div className="cp-top-section">
        {/* Header Bar */}
        <header className="cp-header">
          <motion.button
            className="cp-back-btn"
            onClick={onBack}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </motion.button>

          <div className="cp-brand-logo">
            <span>X</span>pool
          </div>

          <div className="cp-step-badge">
            <ShieldCheck size={14} />
            <span>Step 2 of 2</span>
          </div>
        </header>

        {/* Profile Completion Progress Bar */}
        <div className="cp-progress-card">
          <div className="cp-progress-label-row">
            <span>PROFILE COMPLETION</span>
            <span style={{ color: progressPercentage === 100 ? '#10b981' : '#f59e0b' }}>
              {progressPercentage}%
            </span>
          </div>
          <div className="cp-progress-track">
            <div
              className="cp-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <motion.div
          className="cp-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="cp-hero-icon" variants={itemVariants}>
            <User size={26} />
          </motion.div>

          <motion.h1 className="cp-title" variants={itemVariants}>
            Complete Your Profile{' '}
            {selectedRole && (
              <span className="cp-title-role">
                as {selectedRole === 'driver' ? 'Driver' : 'Passenger'}
              </span>
            )}
          </motion.h1>
          <motion.p className="cp-subtitle" variants={itemVariants}>
            Please provide your details to set up your account.
          </motion.p>

          <motion.form
            className="cp-form-card"
            variants={itemVariants}
            onSubmit={handleSubmit}
          >
            {/* Full Name Field */}
            <div className="cp-field-group">
              <div className="cp-field-label-row">
                <label className="cp-field-label">Full Name</label>
              </div>
              <div
                className={`cp-input-row ${focusedField === 'fullName' ? 'cp-focused' : ''} ${isNameValid ? 'cp-valid' : ''} ${errors.fullName ? 'cp-error' : ''}`}
              >
                <User size={18} className="cp-input-icon" />
                <input
                  type="text"
                  className="cp-input"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors({ ...errors, fullName: null });
                  }}
                  onFocus={() => setFocusedField('fullName')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <AnimatePresence>
                  {isNameValid && (
                    <motion.div
                      className="cp-input-check"
                      variants={checkmarkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Check size={13} strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {errors.fullName && <span className="cp-field-error">{errors.fullName}</span>}
            </div>

            {/* Email Field */}
            <div className="cp-field-group">
              <div className="cp-field-label-row">
                <label className="cp-field-label">Email Address</label>
              </div>
              <div
                className={`cp-input-row ${focusedField === 'email' ? 'cp-focused' : ''} ${isEmailValid ? 'cp-valid' : ''} ${errors.email ? 'cp-error' : ''}`}
              >
                <Mail size={18} className="cp-input-icon" />
                <input
                  type="email"
                  className="cp-input"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <AnimatePresence>
                  {isEmailValid && (
                    <motion.div
                      className="cp-input-check"
                      variants={checkmarkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Check size={13} strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {errors.email && <span className="cp-field-error">{errors.email}</span>}
            </div>

            {/* Gender Selection */}
            <div className="cp-field-group">
              <label className="cp-field-label">Gender</label>
              <div className="cp-gender-row">
                {['Male', 'Female', 'Other'].map((g) => (
                  <motion.button
                    key={g}
                    type="button"
                    className={`cp-gender-pill ${gender === g ? 'active' : ''}`}
                    onClick={() => setGender(g)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{g === 'Male' ? '👨 Male' : g === 'Female' ? '👩 Female' : '🧑 Other'}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Age Field */}
            <div className="cp-field-group">
              <label className="cp-field-label">Age</label>
              <div
                className={`cp-input-row ${focusedField === 'age' ? 'cp-focused' : ''} ${isAgeValid ? 'cp-valid' : ''} ${errors.age ? 'cp-error' : ''}`}
              >
                <Calendar size={18} className="cp-input-icon" />
                <input
                  type="number"
                  className="cp-input"
                  placeholder="e.g. 24"
                  min="18"
                  max="100"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    if (errors.age) setErrors({ ...errors, age: null });
                  }}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <AnimatePresence>
                  {isAgeValid && (
                    <motion.div
                      className="cp-input-check"
                      variants={checkmarkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Check size={13} strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {errors.age && <span className="cp-field-error">{errors.age}</span>}
            </div>

            {/* Create Password Field */}
            <div className="cp-field-group">
              <label className="cp-field-label">Create Password</label>
              <div
                className={`cp-input-row ${focusedField === 'password' ? 'cp-focused' : ''} ${isPasswordValid ? 'cp-valid' : ''} ${errors.password ? 'cp-error' : ''}`}
              >
                <Lock size={18} className="cp-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="cp-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <button
                  type="button"
                  className="cp-toggle-pw-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <AnimatePresence>
                  {isPasswordValid && (
                    <motion.div
                      className="cp-input-check"
                      variants={checkmarkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Check size={13} strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="cp-pw-meter">
                  <div className="cp-pw-bar-track">
                    <div
                      className="cp-pw-bar-fill"
                      style={{ width: `${pwStrength.percent}%`, backgroundColor: pwStrength.color }}
                    />
                  </div>
                  <span className="cp-pw-meter-text" style={{ color: pwStrength.color }}>
                    {pwStrength.label}
                  </span>
                </div>
              )}
              {errors.password && <span className="cp-field-error">{errors.password}</span>}
            </div>

            {/* Confirm Password Field */}
            <div className="cp-field-group">
              <label className="cp-field-label">Confirm Password</label>
              <div
                className={`cp-input-row ${focusedField === 'confirmPassword' ? 'cp-focused' : ''} ${isConfirmPasswordValid ? 'cp-valid' : ''} ${errors.confirmPassword ? 'cp-error' : ''}`}
              >
                <Key size={18} className="cp-input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="cp-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                  }}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <button
                  type="button"
                  className="cp-toggle-pw-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <AnimatePresence>
                  {isConfirmPasswordValid && (
                    <motion.div
                      className="cp-input-check"
                      variants={checkmarkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Check size={13} strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {errors.confirmPassword && <span className="cp-field-error">{errors.confirmPassword}</span>}
            </div>
          </motion.form>
        </motion.div>
      </div>

      {/* Bottom CTA Button */}
      <div className="cp-bottom-section">
        <motion.button
          type="submit"
          className={`cp-cta ${progressPercentage === 100 ? 'cp-cta-all-valid' : ''}`}
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <div className="cp-spinner" />
              <span>Saving Profile…</span>
            </>
          ) : (
            <>
              <span>{progressPercentage === 100 ? 'Complete & Launch' : 'Complete Registration'}</span>
              <ArrowRight size={20} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default CompleteProfile;
