import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './Welcome.css';
import carImage from '../../assets/yellow_car_top_view.png';

const Welcome = ({ onGetStarted, onBack }) => {
    return (
        <div className="welcome-container">
            <div className="content-area">
                {onBack && (
                    <button className="welcome-back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                )}
                <h1 className="welcome-title">
                    Let's<br />
                    Start, your<br />
                    Safe Ride
                </h1>

                <div className="journey-line-container">
                    <div className="vertical-line"></div>
                    <div className="car-wrapper">
                        
                        <img src={carImage} alt="Car" className="journey-car" />
                    </div>
                </div>

                <div className="diagonal-line"></div>

                <button className="get-started-btn" onClick={onGetStarted}>
                    Get Started
                </button>
            </div>

            <div className="bottom-wave">
                <svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" className="wave-svg">
                    <path fill="#F4C430" fillOpacity="1" d="M0,320L0,288C140,280,280,240,500,240C800,240,1100,300,1440,260L1440,320Z"></path>
                </svg>
            </div>
        </div>
    );
};

export default Welcome;

