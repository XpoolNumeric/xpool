import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Manually parse .env files
function parseEnv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const env = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const parts = trimmed.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim();
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const rootEnv = parseEnv('./.env');
const adminEnv = parseEnv('./xpooladminpanel-main/.env');

const supabaseUrl = rootEnv.VITE_SUPABASE_URL || adminEnv.VITE_SUPABASE_URL;
const serviceRoleKey = adminEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing config:", { supabaseUrl, hasServiceKey: !!serviceRoleKey });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listFunctions() {
    console.log("Checking DB connection...");
    const { data, error } = await supabase
        .from('booking_requests')
        .select('id, status, trip_id, seats_requested')
        .limit(5);
        
    console.log("Booking requests test query:", { success: !error, data, error });
}

listFunctions();
