import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';
import xpoolLogo from '../assets/xpool-logo.png';
import './AdminLogin.css';

function AdminLogin() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });

                if (error) throw error;

                if (data.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', data.user.id)
                        .single();

                    if (profile?.role !== 'admin') {
                        await supabase.auth.signOut();
                        throw new Error("Access denied: Not an administrator");
                    }

                    localStorage.setItem('adminAuth', 'true');
                    navigate('/dashboard');
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.fullName,
                            role: 'admin',
                        },
                    },
                });

                if (error) throw error;

                // Create profile record in the profiles table
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            full_name: formData.fullName,
                            role: 'admin',
                            last_screen: 'dashboard',
                            created_at: new Date(),
                            updated_at: new Date()
                        });

                    if (profileError) {
                        console.error('Error creating profile:', profileError);
                        // Don't throw error here, profile might be created by trigger
                    }

                    localStorage.setItem('adminAuth', 'true');
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            console.error("Auth Error:", err);
            setError(err.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-container">
            {/* Background Pattern */}
            <div className="bg-pattern"></div>

            {/* Login Card */}
            <div className="login-card">
                {/* Logo Section */}
                <div className="logo-section">
                    <img src={xpoolLogo} alt="XPOOL" className="logo-image" />
                </div>

                <div className="form-header">
                    <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                    <p>{isLogin ? 'Login to manage drivers and verify documents' : 'Register a new administrator account'}</p>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="login-form">
                    {!isLogin && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                name="fullName"
                                type="text"
                                required
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="admin@xpool.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <button type="submit" disabled={loading} className="submit-btn">
                        {loading && <Loader2 size={18} className="spinner" />}
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>

                <div className="toggle-section">
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        className="toggle-btn"
                    >
                        {isLogin ? "Need an admin account? Register" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
