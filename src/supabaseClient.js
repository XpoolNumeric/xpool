import { createClient } from '@supabase/supabase-js'
import { getStorageAdapter, logEnvironmentInfo, isWebView, getLockAdapter } from './utils/webViewHelper'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log environment info for debugging
logEnvironmentInfo();

const supabaseOptions = {
    auth: {
        // CHANGE THIS TO TRUE - Enable persistence
        persistSession: true,
        // Enable auto-refresh (but with careful handling)
        autoRefreshToken: true,
        // Don't detect session in URL (not needed for mobile apps)
        detectSessionInUrl: false,
        // Use custom storage adapter that works in WebView
        storage: getStorageAdapter(),
        // Custom storage key for Xpool app
        storageKey: 'xpool-auth-token',
        // Flow type for authentication
        flowType: 'pkce',
        // prevent deadlocks on devices with broken navigator.locks
        lock: getLockAdapter()
    },
    global: {
        headers: {
            // Custom header to identify requests from mobile app
            'X-Client-Info': 'xpool-mobile-app'
        }
    },
    // Increase timeout for slower mobile networks
    db: {
        schema: 'public'
    },
    // Realtime options
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions)