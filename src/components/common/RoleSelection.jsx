import React, { useState } from 'react';
import './RoleSelection.css';

const RoleSelection = ({ onFinish }) => {
    const [selectedRole, setSelectedRole] = useState('passenger');

    const handleContinue = () => {
        onFinish(selectedRole);
    };

    return (
        <div className="role-selection-container">
            <div className="role-header">
                
                <div className="status-icons"></div>
            </div>

            <div className="role-content">
                <h2 className="role-title">How do you want to use Xpool?</h2>

                <div className="role-options">
                    <div
                        className={`role-card ${selectedRole === 'passenger' ? 'selected' : ''}`}
                        onClick={() => setSelectedRole('passenger')}
                    >
                        <div className="role-icon passenger-icon">
                           
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor" />
                            </svg>
                        </div>
                        <div className="role-info">
                            <h3>I'm a Passenger</h3>
                            <p>Save money by pooling</p>
                        </div>
                        <div className="role-radio">
                            <div className={`radio-outer ${selectedRole === 'passenger' ? 'checked' : ''}`}>
                                {selectedRole === 'passenger' && <div className="radio-inner"></div>}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`role-card ${selectedRole === 'driver' ? 'selected' : ''}`}
                        onClick={() => setSelectedRole('driver')}
                    >
                        <div className="role-icon driver-icon">
                            
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5C5 13.67 5.67 13 6.5 13C7.33 13 8 13.67 8 14.5C8 15.33 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5C16 13.67 16.67 13 17.5 13C18.33 13 19 13.67 19 14.5C19 15.33 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="currentColor" />
                            </svg>
                        </div>
                        <div className="role-info">
                            <h3>I'm a driver</h3>
                            <p>Earn by sharing rides</p>
                        </div>
                        <div className="role-radio">
                            <div className={`radio-outer ${selectedRole === 'driver' ? 'checked' : ''}`}>
                                {selectedRole === 'driver' && <div className="radio-inner"></div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="role-footer">
                <button className="continue-button" onClick={handleContinue}>
                    Continue
                </button>
                <p className="footer-note">You can switch later through profile settings</p>
            </div>
        </div>
    );
};

export default RoleSelection;

