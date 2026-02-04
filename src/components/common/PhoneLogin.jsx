import React, { useState } from 'react';
import './AuthSelection.css'; // Reusing for consistency, or create PhoneLogin.css

const PhoneLogin = ({ onBack, onProceed }) => {
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (phoneNumber.length >= 10) {
            onProceed(phoneNumber);
        } else {
            alert("Please enter a valid phone number");
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

            <div className="login-form-container" style={{paddingTop: '40px'}}>
                <h2 className="form-title" style={{textAlign: 'left'}}>Enter Your Phone Number<br/>To Drive</h2>
                
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                         <input
                            type="tel"
                            placeholder="+91"
                            className="login-input"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                            style={{marginTop: '20px'}}
                        />
                    </div>

                    <button type="submit" className="auth-btn btn-login" style={{marginTop: 'auto', marginBottom: '20px'}}>
                        Proceed
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PhoneLogin;

