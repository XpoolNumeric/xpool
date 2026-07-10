import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking Wallets...");
    const { data: wallets } = await supabase.from('driver_wallets').select('*');
    console.log("Wallets:", wallets);

    const { data: txs } = await supabase.from('wallet_transactions').select('*');
    console.log("Transactions:", txs);

    const { data: payments } = await supabase.from('ride_payments').select('*');
    console.log("Payments:", payments);

    const { data: trips } = await supabase.from('trips').select('id, status, user_id, price_per_seat').eq('status', 'completed');
    console.log("Completed Trips:", trips);

    const { data: bookings } = await supabase.from('booking_requests').select('id, trip_id, status, drop_status, passenger_id');
    console.log("Bookings:", bookings);
}

check();
