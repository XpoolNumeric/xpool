import React from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import './HelpSupport.css';

const HelpSupport = ({ onBack }) => {
    return (
        <div className="help-container">
            <div className="sub-page-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={24} />
                </button>
                <h2>Help & Support</h2>
            </div>

            <div className="help-content">
                <div className="faq-section">
                    <h3>Frequently Asked Questions</h3>

                    <div className="faq-item">
                        <div className="faq-question">How do I verify my profile?</div>
                        <div className="faq-answer">Go to Edit Profile and ensure all details are filled. Our team reviews profiles within 24 hours.</div>
                    </div>

                    <div className="faq-item">
                        <div className="faq-question">How are prices calculated?</div>
                        <div className="faq-answer">Prices are based on distance and vehicle type. We ensure fair pricing for both drivers and passengers.</div>
                    </div>

                    <div className="faq-item">
                        <div className="faq-question">Can I cancel a ride?</div>
                        <div className="faq-answer">Yes, you can cancel a ride from the "My Trips" section before the journey starts.</div>
                    </div>
                </div>
            </div>

            <button className="contact-btn">
                <MessageCircle size={20} />
                Contact Support Team
            </button>
        </div>
    );
};

export default HelpSupport;

