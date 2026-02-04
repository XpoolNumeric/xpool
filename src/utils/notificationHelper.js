import { supabase } from '../supabaseClient';

/**
 * Notification Helper Functions
 * Handles in-app notifications via Supabase Realtime
 */

/**
 * Create an in-app notification
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} referenceId - Optional reference ID
 * @returns {Promise<object>} Created notification
 */
export const createNotification = async (userId, type, title, message, referenceId = null) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type,
                title,
                message,
                reference_id: referenceId,
                read: false
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Notification Insert Error:', error);
            // Fallback: Try using RPC if direct insert fails (backup plan)
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc('create_notification', {
                    p_user_id: userId,
                    p_type: type,
                    p_title: title,
                    p_message: message,
                    p_reference_id: referenceId
                });
                if (rpcError) throw rpcError;
                return { id: rpcData };
            } catch (rpcErr) {
                console.error('RPC Fallback failed:', rpcErr);
                throw error; // Throw original error
            }
        }
        return data;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const markAllNotificationsAsRead = async (userId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

/**
 * Get unread notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of unread notifications
 */
export const getUnreadNotifications = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting unread notifications:', error);
        return [];
    }
};

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of notifications to fetch
 * @returns {Promise<Array>} Array of notifications
 */
export const getAllNotifications = async (userId, limit = 50) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting notifications:', error);
        return [];
    }
};

/**
 * Subscribe to real-time notifications
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to handle new notifications
 * @returns {object} Subscription object
 */
export const subscribeToNotifications = (userId, callback) => {
    const subscription = supabase
        .channel(`notifications_${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                callback(payload.new);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Unsubscribe from notifications
 * @param {object} subscription - Subscription object
 */
export const unsubscribeFromNotifications = (subscription) => {
    if (subscription) {
        supabase.removeChannel(subscription);
    }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @returns {Promise<void>}
 */
export const deleteNotification = async (notificationId) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
};

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadCount = async (userId) => {
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};
