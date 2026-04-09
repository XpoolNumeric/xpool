import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './AuthSelection.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PhoneLogin = ({ onBack, onProceed, isSignupFlow = false, isAddMode = false }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);

    /**
     * Call a Supabase edge function with automatic fallback.
     * If the user has a valid session, use supabase.functions.invoke().
     * Otherwise, use a direct fetch() with the anon key as Bearer token.
     * This prevents the 406 (Unauthorized) error during signup when
     * no JWT session exists yet.
     */
    const invokeEdgeFunction = async (fnName, body) => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            // User has a session — normal invoke will attach the JWT automatically
            const { data, error } = await supabase.functions.invoke(fnName, { body });
            if (error) throw error;
            return data;
        }

        // No session (e.g. during signup) — call directly with anon key
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Edge function error (${res.status})`);
        return data;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = phoneNumber.trim();
        const digitsOnly = trimmed.replace(/\D/g, '');
        if (digitsOnly.length < 10) {
            toast.error('Please enter a valid phone number (at least 10 digits).');
            return;
        }

        // Ensure E.164 format e.g. +919876543210
        const formatted = trimmed.startsWith('+') ? trimmed : `+91${digitsOnly}`;

        try {
            setLoading(true);

            if (isAddMode) {
                // User is already logged in via Email, just add phone
                const { error } = await supabase.auth.updateUser({
                    phone: formatted
                });
                if (error) throw error;
            } else {
                // Normal new sign in / setup
                const { error } = await supabase.auth.signInWithOtp({
                    phone: formatted,
                });
                if (error) throw error;
            }

            toast.success('OTP sent to your mobile number!');
            onProceed(formatted);
        } catch (error) {
            console.error('[PhoneLogin] OTP send error:', error);
            toast.error(error.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-selection-container">
            <div className="auth-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="auth-title">XPOOL</h1>
            </div>

            <div className="login-form-container" style={{ paddingTop: '40px' }}>
                <h2 className="form-title" style={{ textAlign: 'left' }}>
                    {isAddMode 
                        ? <>Add Mobile Number<br />To Continue</>
                        : (isSignupFlow
                            ? <>Verify your<br />Mobile Number</>
                            : <>Enter Your Phone Number<br />To Continue</>)}
                </h2>
                {isSignupFlow && (
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
                        Step 2 of 2 — We'll send an OTP to confirm your number.
                    </p>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="tel"
                            placeholder="+91XXXXXXXXXX"
                            className="login-input"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                            style={{ marginTop: '20px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-btn btn-login"
                        style={{ marginTop: 'auto', marginBottom: '20px' }}
                        disabled={loading}
                    >
                        {loading ? 'Sending OTP…' : 'Send OTP'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PhoneLogin;

