import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Hook to request native permissions (like Location and Notifications) upon app startup.
 * Only triggers if running as a native app via Capacitor.
 */
export const useNativePermissions = () => {
    useEffect(() => {
        const requestPermissions = async () => {
            // Only request if running natively (Android/iOS)
            if (Capacitor.isNativePlatform()) {
                // 1. Request Location Permission
                try {
                    const status = await Geolocation.checkPermissions();
                    if (status.location !== 'granted') {
                        await Geolocation.requestPermissions();
                    }
                } catch (error) {
                    console.error('[NativePermissions] Failed to request location:', error);
                }

                // 2. Request Notification Permission
                try {
                    const notifStatus = await LocalNotifications.checkPermissions();
                    if (notifStatus.display !== 'granted') {
                        await LocalNotifications.requestPermissions();
                    }
                } catch (error) {
                    console.error('[NativePermissions] Failed to request notifications:', error);
                }
            }
        };

        requestPermissions();
    }, []);
};
