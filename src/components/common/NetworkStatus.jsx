import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import './NetworkStatus.css';

/**
 * NetworkStatus Component
 * Displays a banner when the device loses internet connectivity
 * Automatically hides when connection is restored
 */
const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBanner, setShowBanner] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            console.log('Network: Online');
            setIsOnline(true);

            // Show "Back Online" message briefly
            setShowBanner(true);
            setTimeout(() => {
                setShowBanner(false);
            }, 3000);
        };

        const handleOffline = () => {
            console.log('Network: Offline');
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div className={`network-status-banner ${isOnline ? 'online' : 'offline'}`}>
            <div className="network-status-content">
                {isOnline ? (
                    <>
                        <Wifi size={20} />
                        <span>Back Online</span>
                    </>
                ) : (
                    <>
                        <WifiOff size={20} />
                        <span>No Internet Connection</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default NetworkStatus;
