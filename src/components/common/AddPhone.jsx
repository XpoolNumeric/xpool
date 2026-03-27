import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './AuthSelection.css';

const AddPhone = ({ onComplete }) => {
    const [step, setStep] = useState('input');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [formattedPhone, setFormattedPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    const handleSendOTP = async (e) => {
        e.preventDefault();
        const trimmed = phoneNumber.trim();
        const digitsOnly = trimmed.replace(/\D/g, '');
        if (digitsOnly.length < 10) {
            toast.error('Please enter a valid phone number (at least 10 digits).');
            return;
        }

        const formatted = trimmed.startsWith('+') ? trimmed : `+91${digitsOnly}`;
        setFormattedPhone(formatted);

        try {
            setLoading(true);
            const { error } = await supabase.auth.updateUser({
                phone: formatted
            });
            
            // Supabase returns an error if phone is already used by another account
            if (error) throw error;

            toast.success('Verification code sent to your mobile number!');
            setStep('verify');
        } catch (error) {
            console.error('[AddPhone Error]', error);
            toast.error(error.message || 'Failed to send verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        if (value !== '' && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
            inputRefs[index - 1].current?.focus();
        }
    };

    const handleVerifyOTP = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            toast.error('Please enter the full 6-digit code.');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: otpString,
                type: 'phone_change'
            });

            if (error) {
                // Sometimes for new phones without an old phone, it's just 'phone' verification.
                // If phone_change fails, we can try fallback to 'phone' type.
                console.warn('phone_change verification failed, trying regular phone verification', error);
                const { error: fallbackError } = await supabase.auth.verifyOtp({
                    phone: formattedPhone,
                    token: otpString,
                    type: 'sms'
                });
                if (fallbackError) throw fallbackError || error;
            }

            toast.success('Phone number verified successfully!');
            await onComplete();
        } catch (error) {
            console.error('[AddPhone Verify Error]', error);
            toast.error(error.message || 'Invalid code. Please try again.');
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } finally {
            setLoading(false);
        }
    };

    if (step === 'input') {
        return (
            <div className="auth-selection-container">
                <div className="auth-header">
                    <h1 className="auth-title">XPOOL</h1>
                </div>

                <div className="login-form-container" style={{ paddingTop: '40px' }}>
                    <h2 className="form-title" style={{ textAlign: 'left' }}>
                        Add Mobile Number
                    </h2>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
                        Please link a mobile number to secure your account.
                    </p>

                    <form className="login-form" onSubmit={handleSendOTP}>
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
                            {loading ? 'Sending Code...' : 'Send Verification Code'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-selection-container">
            <div className="auth-header">
                <h1 className="auth-title">XPOOL</h1>
            </div>

            <div className="login-form-container" style={{ paddingTop: '40px' }}>
                <h2 className="form-title" style={{ textAlign: 'left' }}>
                    Verify Mobile Number
                </h2>
                <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
                    Code sent to {formattedPhone}
                </p>

                <div className="otp-inputs" style={{ display: 'flex', gap: '10px', marginTop: '30px', justifyContent: 'center' }}>
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
                            style={{ width: '45px', height: '50px', textAlign: 'center', fontSize: '20px', borderRadius: '8px', border: '1px solid #ccc' }}
                        />
                    ))}
                </div>

                <button
                    onClick={handleVerifyOTP}
                    className="auth-btn btn-login"
                    style={{ marginTop: '40px' }}
                    disabled={loading || otp.join('').length !== 6}
                >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
            </div>
        </div>
    );
};

export default AddPhone;
