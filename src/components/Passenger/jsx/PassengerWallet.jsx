import React from 'react';
import { ArrowLeft, Wallet, Clock } from 'lucide-react';
import '../css/PassengerWallet.css';

const PassengerWallet = ({ onBack }) => {
    return (
        <div className="passenger-wallet-container">
            <div className="pw-header">
                <button className="pw-back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Wallet</h1>
                <div className="pw-header-spacer" />
            </div>

            <div className="pw-coming-soon">
                <div className="pw-icon-ring">
                    <div className="pw-icon-inner">
                        <Wallet size={48} />
                    </div>
                </div>
                <h2>Coming Soon</h2>
                <p>We're building something awesome for you! The Passenger Wallet will let you add funds, track spending, and pay for rides seamlessly.</p>
                <div className="pw-features">
                    <div className="pw-feature">
                        <Clock size={18} />
                        <span>Stay tuned for updates</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PassengerWallet;
