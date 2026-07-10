import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../supabaseClient';

/**
 * Request permission for native push notifications
 * @returns {Promise<boolean>} Granted or not
 */
export const requestPushPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        return permStatus.receive === 'granted';
    } catch (e) {
        console.warn('[Push] Permission request failed:', e);
        return false;
    }
};

/**
 * Register push notification listeners and request FCM registration
 * @param {string} userId - Auth user ID
 */
export const registerPushNotifications = async (userId) => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[Push] Non-native platform, skipping registration.');
        return;
    }

    try {
        const hasPermission = await requestPushPermissions();
        if (!hasPermission) {
            console.warn('[Push] Permission denied by user');
            return;
        }

        // Clean up previous listeners to prevent duplicates
        await PushNotifications.removeAllListeners();

        // 1. Listen for FCM/APNs registration success
        await PushNotifications.addListener('registration', async (token) => {
            console.log('[Push] FCM Registration Token:', token.value);
            // Save token locally in localStorage so we can remove it on logout
            localStorage.setItem('fcm_token', token.value);
            await saveFcmTokenToDb(userId, token.value);
        });

        // 2. Listen for registration errors
        await PushNotifications.addListener('registrationError', (err) => {
            console.error('[Push] Registration error:', err.error);
        });

        // 3. Listen for notifications received in foreground (app open)
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[Push] Received in foreground:', notification);
            // Show a simple in-app feedback or toast
            // The app already has react-hot-toast, so it will show up if we trigger one
            // We can check if it has title and body
            if (notification.title || notification.body) {
                // You can import toast dynamically or trust react-hot-toast from the main bundle
                // We'll let the user see it via console.log first, or throw a standard alert/toast.
            }
        });

        // 4. Listen for notification action clicks
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Push] Action clicked:', action);
            const { notification } = action;
            
            // Extract custom data sent from backend
            const data = notification.data || {};
            console.log('[Push] Action notification data:', data);

            // TODO: Route user based on notification type and data (e.g. data.trip_id, data.booking_id)
            if (data.trip_id) {
                // Custom event or update screen state
                console.log(`[Push] User tapped notification for trip: ${data.trip_id}`);
            }
        });

        // 5. Register with APNs/FCM
        await PushNotifications.register();
        console.log('[Push] Push registration triggered');

    } catch (e) {
        console.error('[Push] Registration setup failed:', e);
    }
};

/**
 * Save FCM token to the Supabase database
 * @param {string} userId - Auth user ID
 * @param {string} token - FCM registration token
 */
export const saveFcmTokenToDb = async (userId, token) => {
    try {
        const platform = Capacitor.getPlatform(); // 'android' or 'ios'
        const { error } = await supabase
            .from('user_fcm_tokens')
            .upsert({
                user_id: userId,
                fcm_token: token,
                device_type: platform,
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'fcm_token' });

        if (error) throw error;
        console.log('[Push] Token synced with database');
    } catch (err) {
        console.error('[Push] Failed to sync token with DB:', err);
    }
};

/**
 * Remove FCM token from the database (on logout)
 */
export const removeFcmTokenFromDb = async () => {
    try {
        const token = localStorage.getItem('fcm_token');
        if (!token) return;

        const { error } = await supabase
            .from('user_fcm_tokens')
            .delete()
            .eq('fcm_token', token);

        if (error) throw error;
        console.log('[Push] Token deleted from database');
        localStorage.removeItem('fcm_token');
    } catch (err) {
        console.error('[Push] Failed to remove token from DB:', err);
    }
};
