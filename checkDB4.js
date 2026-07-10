import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('admin/.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking DB Relations...");
    const tables = ['driver_wallets', 'wallet_transactions', 'withdrawal_requests', 'drivers', 'ride_payments'];
    const results = {};

    for (const t of tables) {
        const { data, error } = await supabaseAdmin.from(t).select('id').limit(1);
        results[t] = { data, error };
        if (error) {
           console.log(`Error on ${t}: ${error.message}`);
        } else {
           console.log(`Table ${t} exists.`);
        }
    }
}

check();
