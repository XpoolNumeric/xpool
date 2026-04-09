import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './AuthSelection.css';
import onboarding1 from '../../assets/onboarding1.png'; // Using as placeholder if needed, or maybe the car from onboarding

const AuthSelection = ({ onLogin, onSignup, onBack, onPhoneLogin }) => {
    return (
        <div className="auth-selection-container">
            <div className="auth-header">
                <button className="back-button" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="auth-title">Welcome to Xpool</h1>
            </div>

            <div className="auth-image-container">
                {/* Placeholder for the car illustration. Using onboarding1 for now as it likely contains the car */}
                <img src={onboarding1} alt="Welcome" className="auth-hero-image" />
            </div>

            <div className="auth-buttons-column" style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '90%', maxWidth: '300px', margin: '0 auto', paddingBottom: '30px' }}>
                <button className="auth-btn btn-phone" onClick={onPhoneLogin} style={{ backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Continue with Phone Number
                </button>

                <div className="divider-container" style={{ margin: '15px 0' }}>
                    <div className="divider-line"></div>
                    <span className="divider-text">or</span>
                    <div className="divider-line"></div>
                </div>

                <button className="auth-btn btn-email" onClick={onLogin} style={{ backgroundColor: '#007AFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Continue with Email
                </button>
            </div>

            <p className="auth-footer-text">
                By continuing you agree to our<br />
                Terms of Service & Privacy Policy
            </p>
        </div>
    );
};

export default AuthSelection;

