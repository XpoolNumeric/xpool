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

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });

            if (error) throw error;
            // The redirect handles the rest
        } catch (error) {
            console.error('[Google Login Error]', error);
            toast.error(error.message || 'Google login failed');
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

                <div className="divider-container">
                    <div className="divider-line"></div>
                    <span className="divider-text">OR</span>
                    <div className="divider-line"></div>
                </div>

                <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>
            </div>

            <div className="login-footer">
                Don't have an account?
                <span className="signup-link" onClick={onSignupClick}>Sign up</span>
            </div>
        </div>
    );
};




export default Login;

