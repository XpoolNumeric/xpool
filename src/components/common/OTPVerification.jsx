import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './AuthSelection.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const OTPVerification = ({ onBack, onVerify, phoneNumber, isSignupFlow = false, isAddMode = false }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    /**
     * Call a Supabase edge function with automatic fallback.
     * If the user has a valid session, use supabase.functions.invoke().
     * Otherwise, use a direct fetch() with the anon key as Bearer token.
     */
    const invokeEdgeFunction = async (fnName, body) => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            const { data, error } = await supabase.functions.invoke(fnName, { body });
            if (error) throw error;
            return data;
        }

        // No session — call directly with anon key
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

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Move to next input
        if (value !== '' && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
            inputRefs[index - 1].current?.focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            toast.error('Please enter the full 6-digit OTP.');
            return;
        }
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otpString,
                type: isAddMode ? 'phone_change' : 'sms'
            });
            if (error) throw error;

            toast.success('Mobile number verified!');
            onVerify(otpString);
        } catch (error) {
            console.error('[OTPVerification] Verify error:', error);
            toast.error(error.message || 'Invalid OTP. Please try again.');
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            setResending(true);
            const { error } = await supabase.auth.resend({
                phone: phoneNumber,
                type: isAddMode ? 'phone_change' : 'sms',
            });
            if (error) throw error;
            toast.success('OTP resent successfully!');
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } catch (error) {
            console.error('[OTPVerification] Resend error:', error);
            toast.error(error.message || 'Failed to resend OTP.');
        } finally {
            setResending(false);
        }
    };

    // Virtual Numeric Keypad handlers
    const handleKeypadClick = (num) => {
        const firstEmptyIndex = otp.findIndex(val => val === '');
        if (firstEmptyIndex !== -1) {
            handleChange(firstEmptyIndex, num.toString());
        }
    };

    const handleBackspace = () => {
        const lastFilledIndex = otp.map((val, i) => val !== '' ? i : -1).reduce((a, b) => Math.max(a, b), -1);
        if (lastFilledIndex !== -1) {
            const newOtp = [...otp];
            newOtp[lastFilledIndex] = '';
            setOtp(newOtp);
            inputRefs[lastFilledIndex].current?.focus();
        }
    };

    const maskedPhone = phoneNumber
        ? phoneNumber.replace(/(\+\d{2})(\d+)(\d{4})/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
        : '';

    return (
        <div className="auth-selection-container">
            <div className="auth-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>

            <div className="otp-image-container" style={{ textAlign: 'center', margin: '20px 0' }}>
                <div style={{ fontSize: '50px' }}>📱</div>
            </div>

            <div className="login-form-container">
                <h2 className="form-title" style={{ textAlign: 'left' }}>
                    {isSignupFlow ? 'Verify Mobile OTP' : 'Enter OTP'}
                </h2>
                <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
                    Code sent to {maskedPhone || phoneNumber}
                </p>

                <div className="otp-inputs" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={inputRefs[index]}
                            type="text"
                            inputMode="numeric"
                            maxLength="1"
                            className="otp-box"
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            style={{
                                width: '50px', height: '50px', textAlign: 'center', fontSize: '20px',
                                borderRadius: '8px', border: '1px solid #ccc', background: '#F0F0F0'
                            }}
                        />
                    ))}
                </div>

                {/* Numeric Keypad Simulation */}
                <div className="numeric-keypad" style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handleKeypadClick(num)} style={{
                            padding: '15px', borderRadius: '10px', border: 'none', background: '#fff',
                            fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}>{num}</button>
                    ))}
                    <button style={{ visibility: 'hidden' }}></button>
                    <button onClick={() => handleKeypadClick(0)} style={{
                        padding: '15px', borderRadius: '10px', border: 'none', background: '#fff',
                        fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>0</button>
                    <button onClick={handleBackspace} style={{
                        padding: '15px', borderRadius: '10px', border: 'none', background: '#fff',
                        fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>⌫</button>
                </div>

                <button
                    onClick={handleVerify}
                    className="auth-btn btn-login"
                    style={{ marginTop: '20px' }}
                    disabled={loading || otp.join('').length !== 6}
                >
                    {loading ? 'Verifying…' : 'Verify & Continue'}
                </button>

                <button
                    onClick={handleResendOtp}
                    className="auth-btn"
                    style={{
                        marginTop: '10px',
                        background: 'transparent',
                        color: '#666',
                        fontSize: '14px',
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: resending ? 'not-allowed' : 'pointer'
                    }}
                    disabled={resending}
                >
                    {resending ? 'Resending…' : "Didn't receive OTP? Resend"}
                </button>
            </div>
        </div>
    );
};

export default OTPVerification;



