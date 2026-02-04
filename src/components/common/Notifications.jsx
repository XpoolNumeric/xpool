import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import './Notifications.css';

const Notifications = ({ onBack }) => {
    const [permission, setPermission] = useState(Notification.permission);
    const [settings, setSettings] = useState({
        push: true,
        email: true,
        sms: false,
        promos: true
    });

    const toggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const requestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            toast.success('Notifications enabled!');
            new Notification('XPool', {
                body: 'Browser notifications are now enabled!',
                icon: '/favicon.ico'
            });
        } else {
            toast.error('Notification permission denied');
        }
    };

    return (
        <div className="notifications-container">
            <div className="sub-page-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={24} />
                </button>
                <h2>Notifications</h2>
            </div>

            <div className="notifications-list">
                {/* Browser Specific Section */}
                <div className="notification-item browser-permission">
                    <div className="notification-info">
                        <h3>Browser Notifications</h3>
                        <p>Get real-time alerts even when the app is closed</p>
                    </div>
                    {permission === 'granted' ? (
                        <div className="status-granted">Enabled</div>
                    ) : (
                        <button className="enable-btn" onClick={requestPermission}>
                            Enable
                        </button>
                    )}
                </div>

                <div className="divider" />

                <div className="notification-item">
                    <div className="notification-info">
                        <h3>Push Notifications</h3>
                        <p>Receive ride updates instantly</p>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.push} onChange={() => toggle('push')} />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="notification-item">
                    <div className="notification-info">
                        <h3>Email Updates</h3>
                        <p>Receive booking receipts and summaries</p>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.email} onChange={() => toggle('email')} />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="notification-item">
                    <div className="notification-info">
                        <h3>SMS Notifications</h3>
                        <p>Get text alerts for urgent updates</p>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.sms} onChange={() => toggle('sms')} />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="notification-item">
                    <div className="notification-info">
                        <h3>Promotional Offers</h3>
                        <p>Deals, discounts, and news</p>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.promos} onChange={() => toggle('promos')} />
                        <span className="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default Notifications;

