import React from 'react';
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

            <div className="auth-buttons">
                <button className="auth-btn btn-login" onClick={onLogin}>
                    Login
                </button>
                <button className="auth-btn btn-create" onClick={onSignup}>
                    Create Account
                </button>
            </div>

            <div className="divider-container">
                <div className="divider-line"></div>
                <span className="divider-text">or continue with</span>
                <div className="divider-line"></div>
            </div>

            <button className="auth-btn btn-phone" onClick={onPhoneLogin} style={{ marginBottom: '20px', backgroundColor: '#eee', color: '#000' }}>
                Continue with Phone Number
            </button>

            <div className="social-login-container">
                <div className="social-btn google">
                    <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                </div>
                <div className="social-btn apple">
                    <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24.02-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78.79.04 1.97-.71 3.28-.68 1.36.02 2.36.53 3.05 1.48-2.76 1.58-2.36 5.78.26 6.99-.54 1.53-1.25 3.09-2.34 4.4zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#000" />
                    </svg>
                </div>
                <div className="social-btn facebook">
                    <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9V12h2.54V9.79c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99C18.34 21.12 22 16.99 22 12z" fill="#1877F2" />
                    </svg>
                </div>
            </div>

            <p className="auth-footer-text">
                By continuing you agree to our<br />
                Terms of Service & Privacy Policy
            </p>
        </div>
    );
};

export default AuthSelection;

