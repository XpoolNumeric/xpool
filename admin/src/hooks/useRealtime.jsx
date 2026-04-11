import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useRealtime — Subscribe to Supabase Realtime changes on a table.
 *
<<<<<<< HEAD
 * FEATURES:
 *  - Uses a ref for the callback to prevent infinite re-subscriptions
 *  - Automatic retry with exponential backoff on CHANNEL_ERROR
 *  - Graceful cleanup on unmount
 *
 * @param {string} table - Supabase table name to listen to
 * @param {Function} onUpdate - Callback when a change is detected
 * @param {object} [options] - Optional config
 * @param {number} [options.maxRetries=3] - Max retry attempts on error
 * @param {string} [options.event='*'] - Postgres event filter: 'INSERT', 'UPDATE', 'DELETE', '*'
 */
export const useRealtime = (table, onUpdate, options = {}) => {
    const { maxRetries = 3, event = '*' } = options;
    const callbackRef = useRef(onUpdate);
    const retryCountRef = useRef(0);
    const channelRef = useRef(null);
=======
 * BUG FIX: Previously, `onUpdate` was in the useEffect dependency array,
 * causing infinite re-subscriptions when the parent component re-rendered
 * (because the callback was a new function reference each time).
 *
 * FIX: We use a ref to hold the latest callback, so the subscription is
 * only created once per table name. The ref always calls the latest version.
 *
 * @param {string} table - Supabase table name to listen to
 * @param {Function} onUpdate - Callback when a change is detected
 */
export const useRealtime = (table, onUpdate) => {
    const callbackRef = useRef(onUpdate);
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

    // Always keep the ref pointing to the latest callback
    useEffect(() => {
        callbackRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!table) return;

<<<<<<< HEAD
        const subscribe = () => {
            // Clean up previous channel if any
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            const channel = supabase
                .channel(`realtime:${table}:${Date.now()}`)
                .on(
                    'postgres_changes',
                    { event, schema: 'public', table },
                    (payload) => {
                        if (callbackRef.current) {
                            callbackRef.current(payload);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        retryCountRef.current = 0; // Reset on success
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.warn(`[Realtime] Channel error on ${table}`);
                        // Retry with exponential backoff
                        if (retryCountRef.current < maxRetries) {
                            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
                            retryCountRef.current += 1;
                            console.log(`[Realtime] Retrying ${table} in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
                            setTimeout(subscribe, delay);
                        } else {
                            console.error(`[Realtime] Max retries reached for ${table}`);
                        }
                    }
                });

            channelRef.current = channel;
        };

        subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [table, event, maxRetries]); // Only re-subscribe when table/event/maxRetries change
=======
        const channel = supabase
            .channel(`realtime:${table}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                (payload) => {
                    console.log(`[Realtime] ${table}`, payload.eventType);
                    if (callbackRef.current) {
                        callbackRef.current(payload);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] Subscribed → ${table}`);
                }
                if (status === 'CHANNEL_ERROR') {
                    console.warn(`[Realtime] Channel error on ${table}`);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table]); // Only re-subscribe when table name changes
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
};
