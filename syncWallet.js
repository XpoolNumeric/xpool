import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('admin/.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function sync() {
    console.log("Starting wallet sync for lost transactions...");

    const { data: payments } = await supabaseAdmin.from('ride_payments').select('*').eq('payment_status', 'pending');

    if (!payments || payments.length === 0) {
        console.log("No pending payments found.");
        return;
    }

    for (const payment of payments) {
        // check if trip is actually completed
        const { data: trip } = await supabaseAdmin.from('trips').select('status, user_id').eq('id', payment.trip_id).single();
        if (trip && trip.status === 'completed') {
            console.log(`Syncing payment ${payment.id} for trip ${payment.trip_id}`);

            // 1. Ensure driver exists
            const { data: driverExists } = await supabaseAdmin.from('drivers').select('id').eq('user_id', payment.driver_id).maybeSingle();
            if (!driverExists) {
                console.log("Creating missing driver record...");
                await supabaseAdmin.from('drivers').insert({ user_id: payment.driver_id, status: 'approved' });
            }

            // 2. Set payment to 'paid'
            console.log("Marking payment as paid...");
            await supabaseAdmin.from('ride_payments').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id);

            // 3. Run RPC to deduct commission
            console.log("Running RPC deductor...");
            const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('deduct_commission_and_check_wallet', {
                p_driver_user_id: payment.driver_id,
                p_amount: payment.commission_amount,
                p_ride_id: payment.trip_id,
                p_description: 'Commission Deducted for Cash Trip (Auto-sync)'
            });
            if (rpcErr) {
                console.error("RPC Error:", rpcErr);
            } else {
                console.log("RPC Success:", rpcData);
            }
        }
    }
    console.log("Sync complete!");
}

sync();
    }

console.log(`Sync complete! Processed ${syncedCount} missing transactions.`);
}

sync();
