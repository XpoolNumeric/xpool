import { supabase } from '../supabaseClient';

/**
 * Basic structured logging helper
 */
const log = (msg, data = null) => {
    if (data) console.log(`[UserStateSync] ${msg}`, data);
    else console.log(`[UserStateSync] ${msg}`);
};

/**
 * Wraps a promise with a timeout so network hangs on app resume
 * (e.g. cold connections, stale sockets) never block indefinitely.
 *
 * @param {Promise} promise - The promise to race
 * @param {number}  ms      - Timeout in milliseconds (default 5000)
 * @returns {Promise}       - Resolves/rejects with the original promise, or rejects on timeout
 */
const withTimeout = (promise, ms = 5000) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[UserStateSync] Request timed out after ${ms}ms`)), ms)
        ),
    ]);

/**
 * Updates the user's current screen and role in the database.
 * 
 * @param {string} userId - The user's ID
 * @param {string} screen - The current screen name
 * @param {string} role - The user's role (optional)
 */
export const syncStateToBackend = async (userId, screen, role) => {
    if (!userId) return;

    try {
        // Prepare update object
        const updates = {
            updated_at: new Date().toISOString(),
            last_screen: screen,
        };

        // Only add role if it's defined
        if (role) {
            updates.user_role = role;
        }

        // Perform update
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) {
            console.error('[UserStateSync] Error syncing state:', error.message);
        }
    } catch (error) {
        console.error('[UserStateSync] Exception in syncStateToBackend:', error);
    }
};

/**
 * Fetches the user's last saved state from the database.
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<{screen: string, role: string, driverStatus?: string} | null>}
 */
export const fetchStateFromBackend = async (userId) => {
    if (!userId) return null;

    try {
        // 1. Fetch Profile (Screen & Role) — wrapped in timeout to guard against
        //    slow/stale network connections when the app resumes from background.
        const profileQuery = supabase
            .from('profiles')
            .select('last_screen, user_role, full_name')
            .eq('id', userId)
            .single();

        const { data: profile, error: profileError } = await withTimeout(profileQuery)
            .catch((err) => {
                console.warn('[UserStateSync] Profile fetch timed out or failed:', err.message);
                return { data: null, error: err };
            });

        if (profileError || !profile) {
            console.warn('[UserStateSync] Profile not found or error:', profileError?.message);
            return null;
        }

        const result = {
            screen: profile.last_screen,
            role: profile.user_role,
            full_name: profile.full_name,
            driverStatus: null
        };

        // 2. If Driver, Fetch Driver Status — also wrapped with timeout
        if (result.role === 'driver') {
            const driverQuery = supabase
                .from('drivers')
                .select('*') // Select all to check for 'status' existence
                .eq('user_id', userId);

            const { data: drivers, error: driverError } = await withTimeout(driverQuery)
                .catch((err) => {
                    console.warn('[UserStateSync] Driver fetch timed out or failed:', err.message);
                    return { data: null, error: err };
                });

            if (!driverError && drivers && drivers.length > 0) {
                // Helper to safely get lowercase status
                const getStatus = (d) => (d.status || '').toLowerCase();

                // Check for Approved or Pending status across all records
                const hasApproved = drivers.some(d => getStatus(d) === 'approved');
                const hasPending = drivers.some(d => getStatus(d) === 'pending');

                if (hasApproved) {
                    result.driverStatus = 'approved';
                } else if (hasPending) {
                    result.driverStatus = 'pending';
                } else {
                    // Check for missing status column (Migration Safety)
                    if (drivers[0].status === undefined) {
                        console.warn('[UserStateSync] "status" column missing! Defaulting to approved.');
                        result.driverStatus = 'approved';
                    } else {
                        result.driverStatus = 'rejected';
                    }
                }

                log('Driver status resolved:', result.driverStatus);
            } else {
                log('No driver records found.');
            }
        }

        return result;

    } catch (error) {
        console.error('[UserStateSync] Exception in fetchStateFromBackend:', error);
        return null;
    }
};