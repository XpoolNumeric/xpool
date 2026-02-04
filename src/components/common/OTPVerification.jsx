import React, { useState, useRef, useEffect } from 'react';
import './AuthSelection.css';

const OTPVerification = ({ onBack, onVerify, phoneNumber }) => {
    const [otp, setOtp] = useState(['', '', '', '']);
    const inputRefs = [useRef(), useRef(), useRef(), useRef()];

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Move to next input
        if (value !== '' && index < 3) {
            inputRefs[index + 1].current.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
            inputRefs[index - 1].current.focus();
        }
    };

    const handleVerify = () => {
        const otpString = otp.join('');
        // Mock validation: 1234 or any 4 digit for now
        if (otpString.length === 4) {
            onVerify(otpString);
        } else {
            alert("Please enter a valid 4-digit OTP");
        }
    };

    // Virtual Numeric Keypad handlers (optional, matching design)
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
            inputRefs[lastFilledIndex].current.focus();
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
            </div>

            <div className="otp-image-container" style={{ textAlign: 'center', margin: '20px 0' }}>
                {/* Placeholder for OTP illustration */}
                <div style={{ fontSize: '50px' }}>📱</div>
            </div>

            <div className="login-form-container">
                <h2 className="form-title" style={{ textAlign: 'left' }}>Enter OTP</h2>

                <div className="otp-inputs" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={inputRefs[index]}
                            type="text"
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

                {/* Numeric Keypad Simulation - attempting to match design */}
                <div className="numeric-keypad" style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handleKeypadClick(num)} style={{
                            padding: '15px', borderRadius: '10px', border: 'none', background: '#fff', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}>{num}</button>
                    ))}
                    <button style={{ visibility: 'hidden' }}></button>
                    <button onClick={() => handleKeypadClick(0)} style={{
                        padding: '15px', borderRadius: '10px', border: 'none', background: '#fff', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>0</button>
                    <button onClick={handleBackspace} style={{
                        padding: '15px', borderRadius: '10px', border: 'none', background: '#fff', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>⌫</button>
                </div>

                <button onClick={handleVerify} className="auth-btn btn-login" style={{ marginTop: '20px' }}>
                    Proceed
                </button>
            </div>
        </div>
    );
};

export default OTPVerification;

