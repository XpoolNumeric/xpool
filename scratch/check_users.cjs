const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
        console.log('Profiles:', profiles.map(p => ({ id: p.id, name: p.full_name, role: p.role || 'unknown' })));

        const { data: trips } = await supabase.from('trips').select('*').limit(5);
        console.log('Trips:', trips.map(t => ({ id: t.id, driver: t.user_id, status: t.status })));

        const { data: bookings } = await supabase.from('booking_requests').select('*').limit(5);
        console.log('Bookings:', bookings.map(b => ({ id: b.id, trip: b.trip_id, status: b.status, passenger: b.passenger_id, driver: b.driver_id })));
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
