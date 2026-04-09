import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Signup.css';

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
            console.error('Signup error:', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="signup-title-main">XPOOL</h1>
            </div>

            <div className="signup-form-container">
                <h2 className="form-title">{isAddMode ? 'Add Email & Password' : 'Create your Account'}</h2>
                {isAddMode && (
                    <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
                        Finish setting up your account by providing an email.
                    </p>
                )}

                <form className="signup-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <div className="input-icon">☃</div>
                        <input
                            type="text"
                            placeholder="Full Name"
                            className="signup-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <div className="input-icon">✉</div>
                        <input
                            type="email"
                            placeholder="Email"
                            className="signup-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <div className="input-icon">☪</div>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            className="signup-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="input-group">
                        <div className="input-icon">♕</div>
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            className="signup-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                            {showConfirmPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <button type="submit" className="signup-btn" disabled={loading}>
                        {loading ? 'Saving...' : (isAddMode ? 'Verify Email' : 'Sign Up')}
                    </button>
                </form>
            </div>

            {!isAddMode && (
                <div className="signup-footer">
                    Already have an account?
                    <span className="login-link" onClick={onLoginClick}>Sign in</span>
                </div>
            )}
        </div>
    );
};

export default Signup;

