import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useRealtime — Subscribe to Supabase Realtime changes on a table.
 *
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

    // Always keep the ref pointing to the latest callback
    useEffect(() => {
        callbackRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!table) return;

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
};
