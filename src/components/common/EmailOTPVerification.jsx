import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './EmailOTPVerification.css';

const EmailOTPVerification = ({ email, onVerified, onBack }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) {
            setCanResend(true);
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleChange = (index, value) => {
        // Accept only single digit
        if (!/^\d*$/.test(value)) return;
        const digit = value.slice(-1); // take last char if pasted multiple
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        // Auto-advance to next box
        if (digit !== '' && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (otp[index] !== '') {
                // Clear current box
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            } else if (index > 0) {
                // Move back
                inputRefs[index - 1].current?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs[index - 1].current?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 0) return;
        const newOtp = ['', '', '', '', '', ''];
        pasted.split('').forEach((char, i) => { newOtp[i] = char; });
        setOtp(newOtp);
        // Focus the last filled box or the one after
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs[focusIndex].current?.focus();
    };

    const handleVerify = async () => {
        const token = otp.join('');
        if (token.length !== 6) {
            toast.error('Please enter the full 6-digit code.');
            return;
        }
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'email',
            });
            if (error) throw error;

            // Save session tokens after verification
            if (data?.session) {
                localStorage.setItem('xpool_manual_token', JSON.stringify({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                }));
            }

            toast.success('Email verified!');
            if (onVerified) await onVerified();
        } catch (error) {
            console.error('[EmailOTP] Verify error:', error);
            toast.error(error.message || 'Invalid or expired code. Please try again.');
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;
        try {
            setResending(true);
            const { error } = await supabase.auth.resend({
                email,
                type: 'signup',
            });
            if (error) throw error;
            toast.success('Verification code resent! Check your inbox.');
            setCountdown(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } catch (error) {
            console.error('[EmailOTP] Resend error:', error);
            toast.error(error.message || 'Could not resend code. Try again later.');
        } finally {
            setResending(false);
        }
    };

    // Auto-focus first input on mount
    useEffect(() => {
        inputRefs[0].current?.focus();
    }, []);

    const maskedEmail = email
        ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
        : '';

    return (
        <div className="eotp-container">
            <div className="eotp-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="eotp-brand">XPOOL</h1>
            </div>

            <div className="eotp-body">
                <div className="eotp-icon">✉️</div>
                <h2 className="eotp-title">Verify your Email</h2>
                <p className="eotp-subtitle">
                    We sent a 6-digit verification code to
                </p>
                <p className="eotp-email">{maskedEmail}</p>

                <div className="eotp-inputs" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={inputRefs[index]}
                            type="text"
                            inputMode="numeric"
                            maxLength="1"
                            className={`eotp-box ${digit ? 'eotp-box--filled' : ''}`}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            autoComplete="one-time-code"
                        />
                    ))}
                </div>

                <button
                    className="eotp-verify-btn"
                    onClick={handleVerify}
                    disabled={loading || otp.join('').length !== 6}
                >
                    {loading ? (
                        <span className="eotp-spinner"></span>
                    ) : (
                        'Verify & Continue'
                    )}
                </button>

                <div className="eotp-resend">
                    {canResend ? (
                        <button
                            className="eotp-resend-btn"
                            onClick={handleResend}
                            disabled={resending}
                        >
                            {resending ? 'Resending...' : 'Resend Code'}
                        </button>
                    ) : (
                        <p className="eotp-countdown">
                            Resend code in <span>{countdown}s</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmailOTPVerification;
