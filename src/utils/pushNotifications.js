import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '../supabaseClient';

let notificationClickCallback = null;

/**
 * Register callback to receive notification click events.
 * Also processes any pending notification data stored during cold boot.
 * @param {Function|null} callback
 */
export const setNotificationClickCallback = (callback) => {
    notificationClickCallback = callback;

    if (!callback) return;

    // Process any pending notification data that was stored during cold start
    try {
        const pendingDataStr = localStorage.getItem('pending_notification_data');
        if (pendingDataStr) {
            console.log('[Push] Found pending notification data, firing callback:', pendingDataStr);
            const pendingData = JSON.parse(pendingDataStr);
            localStorage.removeItem('pending_notification_data');
            // Fire in next tick so the React component tree is fully mounted
            setTimeout(() => {
                if (notificationClickCallback) {
                    notificationClickCallback(pendingData);
                }
            }, 300);
        }
    } catch (err) {
        console.error('[Push] Error processing pending notification data:', err);
    }
};

/**
 * Internal: extract routing data from a raw FCM/local notification payload and route.
 */
const handleActionClick = (data) => {
    console.log('[Push] handleActionClick data:', data);

    // Normalise – FCM data values are strings
    const normalized = {
        type: data.type || data.notification_type || null,
        booking_id: data.booking_id || data.bookingId || null,
        reference_id: data.reference_id || data.referenceId || null,
        trip_id: data.trip_id || data.tripId || null,
    };

    if (notificationClickCallback) {
        notificationClickCallback(normalized);
    } else {
        // App not ready yet — persist for later
        console.log('[Push] Callback not registered yet. Storing action data for later.');
        localStorage.setItem('pending_notification_data', JSON.stringify(normalized));
    }
};

/**
 * Request permissions for push & local notifications.
 * @returns {Promise<boolean>}
 */
export const requestPushPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        // Request local notification permission too
        try {
            let localPerm = await LocalNotifications.checkPermissions();
            if (localPerm.display !== 'granted') {
                await LocalNotifications.requestPermissions();
            }
        } catch (localErr) {
            console.warn('[Push] Local notification permission request failed:', localErr);
        }

        return permStatus.receive === 'granted';
    } catch (e) {
        console.warn('[Push] Permission request failed:', e);
        return false;
    }
};

/**
 * Create high-importance Android notification channel so foreground notifications
 * appear as heads-up banners in the status bar.
 */
const ensureNotificationChannel = async () => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
        await LocalNotifications.createChannel({
            id: 'xpool_foreground',
            name: 'xPool Alerts',
            description: 'Ride and booking alerts',
            importance: 5,      // IMPORTANCE_HIGH
            visibility: 1,      // VISIBILITY_PUBLIC
            vibration: true,
            lights: true,
        });
        console.log('[Push] Android notification channel created/verified.');
    } catch (err) {
        console.warn('[Push] createChannel error (may already exist):', err);
    }
};

/**
 * Register push notification listeners and trigger FCM registration.
 * @param {string} userId
 */
export const registerPushNotifications = async (userId) => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[Push] Non-native platform, skipping.');
        return;
    }

    try {
        // 1. Create the Android channel FIRST before anything else
        await ensureNotificationChannel();

        const hasPermission = await requestPushPermissions();
        if (!hasPermission) {
            console.warn('[Push] Notification permission denied by user.');
            return;
        }

        // 2. Remove old listeners to prevent duplicates on re-registration
        await PushNotifications.removeAllListeners();
        // Remove local notification listeners separately (they are independent)
        try { await LocalNotifications.removeAllListeners(); } catch (_) {}

        // ── FCM / Remote push listeners ─────────────────────────────────────

        // Token registered
        PushNotifications.addListener('registration', async (token) => {
            console.log('[Push] FCM Token:', token.value.substring(0, 20) + '...');
            localStorage.setItem('fcm_token', token.value);
            await saveFcmTokenToDb(userId, token.value);
        });

        // Registration error
        PushNotifications.addListener('registrationError', (err) => {
            console.error('[Push] FCM registration error:', err.error);
        });

        // Notification received while app is IN FOREGROUND
        // FCM suppresses the system banner when app is open — we must show a local one.
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('[Push] Foreground push received:', notification);

            // Build extra data to carry through the local notification
            const extra = {
                type: notification.data?.type || null,
                booking_id: notification.data?.booking_id || null,
                reference_id: notification.data?.reference_id || null,
                trip_id: notification.data?.trip_id || null,
            };

            try {
                await LocalNotifications.schedule({
                    notifications: [{
                        id: Date.now() % 2147483647, // must be a 32-bit int
                        title: notification.title || 'xPool',
                        body: notification.body || '',
                        channelId: 'xpool_foreground',
                        extra,
                        // Schedule 1 second from now — 10ms is too tight and often misfires
                        schedule: { at: new Date(Date.now() + 1000) },
                        smallIcon: 'ic_notification', // optional: set your own small icon resource
                        iconColor: '#FF6B00',
                    }],
                });
                console.log('[Push] Foreground local notification scheduled.');
            } catch (schedErr) {
                console.error('[Push] Failed to schedule local notification:', schedErr);
            }
        });

        // Notification tapped while app is in BACKGROUND / FOREGROUND (remote FCM)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Push] Remote notification tapped:', action);
            const data = action.notification?.data || {};
            handleActionClick(data);
        });

        // ── Local notification listeners ─────────────────────────────────────

        // Local notification banner tapped (foreground scheduled banner)
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
            console.log('[Push] Local notification tapped:', action);
            const data = action.notification?.extra || {};
            handleActionClick(data);
        });

        // 3. Register with FCM (triggers 'registration' callback above)
        await PushNotifications.register();
        console.log('[Push] FCM registration triggered.');

    } catch (e) {
        console.error('[Push] registerPushNotifications failed:', e);
    }
};

/**
 * Save FCM token to Supabase.
 */
export const saveFcmTokenToDb = async (userId, token) => {
    try {
        const platform = Capacitor.getPlatform();
        const { error } = await supabase
            .from('user_fcm_tokens')
            .upsert({
                user_id: userId,
                fcm_token: token,
                device_type: platform,
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'fcm_token' });

        if (error) throw error;
        console.log('[Push] FCM token synced to DB.');
    } catch (err) {
        console.error('[Push] Failed to sync FCM token:', err);
    }
};

/**
 * Remove FCM token from Supabase on logout.
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
        console.log('[Push] FCM token removed from DB.');
        localStorage.removeItem('fcm_token');
    } catch (err) {
        console.error('[Push] Failed to remove FCM token:', err);
    }
};
