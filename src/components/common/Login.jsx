import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Login.css';

const Login = ({ onBack, onSignupClick, onLoginSuccess, role }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // ROLE SWITCHING FIX: Removed blocking role check
            // The App.jsx handleLoginSuccess() will update the profile.user_role
            // to match the selected role, allowing users to switch between
            // passenger and driver using the same account.
            // 
            // Old code (REMOVED):
            // const userRole = data.user?.user_metadata?.role;
            // if (role && userRole && role !== userRole) {
            //     await supabase.auth.signOut();
            //     throw new Error(`Access Denied: You are registered as a ${userRole}, not a ${role}.`);
            // }

            // Manually save session specifically for WebView manual restoration
            if (data?.session) {
                console.log('[Login] Checkpoint: Saving manual session bundle to localStorage');
                const sessionBundle = {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token
                };
                localStorage.setItem('xpool_manual_token', JSON.stringify(sessionBundle));
            }

            toast.success('Login successful!');

            // Await the login success callback to ensure navigation happens
            if (onLoginSuccess) {
                try {
                    await onLoginSuccess();
                } catch (callbackError) {
                    console.error('Error in onLoginSuccess:', callbackError);
                    toast.error('Navigation failed. Please try again.');
                }
            }

        } catch (error) {
            console.error('[Login Error]', error);
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))) {
                toast.error('Network Error: Check internet, ad-blockers, or VPN.');
            } else {
                toast.error(error.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="login-title-main">XPOOL</h1>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>v2.0 - Manual Fix</p>
            </div>

            <div className="login-form-container">
                <h2 className="form-title">Login to your Account</h2>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <div className="input-icon">✉</div>
                        <input
                            type="email"
                            placeholder="Email"
                            className="login-input"
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
                            className="login-input"
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

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>

            <div className="login-footer">
                Don't have an account?
                <span className="signup-link" onClick={onSignupClick}>Sign up</span>
            </div>
        </div>
    );
};




export default Login;

