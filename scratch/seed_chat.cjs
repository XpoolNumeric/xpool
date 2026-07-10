const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('admin/.env', 'utf-8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

const driverId = '070a67bf-68c0-41c3-a8c7-4016fb1bf6bb';
const passengerId = 'e8cba1be-abe5-47a2-9d39-7c162892d54f';

async function seed() {
    try {
        // Since the previous run successfully seeded the trip and booking, we'll fetch or insert
        // Let's just create a new one to be clean, or use the existing booking.
        // Actually, let's delete any existing booking and trip for these users first to keep it clean.
        await supabase.from('booking_requests').delete().eq('passenger_id', passengerId);
        await supabase.from('trips').delete().eq('user_id', driverId);

        // 1. Create a trip
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .insert({
                user_id: driverId,
                from_location: 'Mumbai Airport, Mumbai',
                to_location: 'Bandra West, Mumbai',
                travel_date: '2026-07-15',
                travel_time: '10:00:00',
                available_seats: 4,
                price_per_seat: 150,
                status: 'active',
                vehicle_type: 'car'
            })
            .select()
            .single();

        if (tripError) throw tripError;
        console.log('Seeded Trip:', trip.id);

        // 2. Create an approved booking request
        const { data: booking, error: bookingError } = await supabase
            .from('booking_requests')
            .insert({
                trip_id: trip.id,
                passenger_id: passengerId,
                driver_id: driverId,
                seats_requested: 2,
                status: 'approved'
            })
            .select()
            .single();

        if (bookingError) throw bookingError;
        console.log('Seeded Booking:', booking.id);

        // 3. Create initial messages
        const { data: m1, error: m1Error } = await supabase
            .from('messages')
            .insert({
                trip_id: trip.id,
                booking_id: booking.id,
                sender_id: passengerId,
                content: 'Hello, looking forward to the ride!'
            })
            .select()
            .single();
        if (m1Error) throw m1Error;

        const { data: m2, error: m2Error } = await supabase
            .from('messages')
            .insert({
                trip_id: trip.id,
                booking_id: booking.id,
                sender_id: driverId,
                content: 'Hey there! Yes, see you soon.'
            })
            .select()
            .single();
        if (m2Error) throw m2Error;

        console.log('Seeded Messages successfully.');
    } catch (e) {
        console.error('Error seeding data:', e);
    }
}

seed();
