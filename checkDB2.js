import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: wallets } = await supabase.from('driver_wallets').select('*');
    const { data: txs } = await supabase.from('wallet_transactions').select('*');
    const { data: payments } = await supabase.from('ride_payments').select('*');
    const { data: trips } = await supabase.from('trips').select('id, status, user_id, price_per_seat').eq('status', 'completed');
    const { data: bookings } = await supabase.from('booking_requests').select('*');
    fs.writeFileSync('db_out.json', JSON.stringify({wallets, txs, payments, trips, bookings}, null, 2));
    console.log("Done");
}

check();
