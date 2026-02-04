import React, { useState } from 'react';
import './Onboarding.css';

import onboarding1 from '../../assets/onboarding1.png';
import onboarding2 from '../../assets/onboarding2.png';
import onboarding3 from '../../assets/onboarding3.png';
import onboardingBottom from '../../assets/onboarding-bottom.png';

const slides = [
    {
        id: 1,
        image: onboarding1,
        title: 'Find rides instantly',
        description: 'Search & book shared rides near you',
        bottomImage: onboardingBottom
    },
    {
        id: 2,
        image: onboarding2,
        title: 'Be a driver or passenger',
        description: 'Switch between roles anytime',
        bottomImage: onboardingBottom
    },
    {
        id: 3,
        image: onboarding3,
        title: 'Save time & money',
        description: 'Pool smarter, travel better',
        bottomImage: onboardingBottom
    }
];

const Onboarding = ({ onFinish }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null); // Reset
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNext();
        }
        if (isRightSwipe) {
            handlePrev();
        }
    };

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        } else if (currentSlide === slides.length - 1) {
            // Only allow finish if on last slide via button click mostly, 
            // but swipe on last slide could also trigger it or just do nothing.
            // User requested button only on last screen.
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleFinish = () => {
        onFinish();
    };

    return (
        <div
            className="onboarding-container"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >


            <div className="onboarding-header">
                {/* Only show Skip if not on last slide? Or always? User didn't specify, leaving as is for now */}
                {currentSlide < slides.length - 1 && (
                    <button className="skip-button" onClick={onFinish}>Skip</button>
                )}
            </div>


            <div className="onboarding-content">

                <div className="app-title">XPOOL</div>

                <div className="image-container">
                    <img
                        src={slides[currentSlide].image}
                        alt="Onboarding"
                        className="slide-image"
                    />
                </div>

                <div className="slide-content-text">
                    <h2 className="slide-title">{slides[currentSlide].title}</h2>
                    <p className="slide-description">{slides[currentSlide].description}</p>
                </div>

                {currentSlide === slides.length - 1 && (
                    <button className="continue-button" onClick={handleFinish}>
                        Continue
                    </button>
                )}

            </div>


            <div className="onboarding-footer">

                <div className="controls-wrapper">
                    <div className="dots-container">
                        {slides.map((_, index) => (
                            <span
                                key={index}
                                className={`dot ${currentSlide === index ? 'active' : ''}`}
                                onClick={() => setCurrentSlide(index)}
                            ></span>
                        ))}
                    </div>
                </div>

                <div className="bottom-image-container">
                    <img
                        src={slides[currentSlide].bottomImage}
                        className="bottom-image"
                    />
                </div>

            </div>

        </div>
    );
};

export default Onboarding;

