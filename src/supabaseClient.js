import { createClient } from '@supabase/supabase-js'
import { getStorageAdapter, logEnvironmentInfo, isWebView } from './utils/webViewHelper'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log environment info for debugging
logEnvironmentInfo();

const supabaseOptions = {
    auth: {
        // DISABLE internal persistence to prevent WebView hangs (we handle this manually in App.jsx)
        persistSession: false,
        // DISABLE auto-refresh to prevent network loops/hangs
        autoRefreshToken: false,
        // Don't detect session in URL (not needed for mobile apps)
        detectSessionInUrl: false,
        // Use custom storage adapter that works in WebView
        storage: getStorageAdapter(),
        // Custom storage key for Xpool app
        storageKey: 'xpool-auth-token',
        // Flow type for authentication
        flowType: 'pkce'
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
//only for testing
// console.log(
//   'SUPABASE URL:',
//   import.meta.env.https://zuppuxrammhisswduryw.supabase.co
// )
// console.log(
//   'SUPABASE KEY:',
//   import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20)
// )
