import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Hook to request native permissions (like Location) upon app startup.
 * Only triggers if running as a native app via Capacitor.
 */
export const useNativePermissions = () => {
    useEffect(() => {
        const requestPermissions = async () => {
            // Only request if running natively (Android/iOS)
            if (Capacitor.isNativePlatform()) {
                try {
                    const status = await Geolocation.checkPermissions();
                    console.log('[NativePermissions] Current location permission status:', status);

                    if (status.location !== 'granted') {
                        const request = await Geolocation.requestPermissions();
                        console.log('[NativePermissions] Requested permissions outcome:', request);
                    }
                } catch (error) {
                    console.error('[NativePermissions] Failed to check or request permissions:', error);
                }
            }
        };

        requestPermissions();
    }, []);
};
