const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('admin/.env', 'utf-8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

const driverId = '070a67bf-68c0-41c3-a8c7-4016fb1bf6bb';
const passengerId = 'e8cba1be-abe5-47a2-9d39-7c162892d54f';

async function update() {
    try {
        const { data: { user: driverUser }, error: driverError } = await supabase.auth.admin.getUserById(driverId);
        if (driverError) throw driverError;

        const { data: { user: passengerUser }, error: passengerError } = await supabase.auth.admin.getUserById(passengerId);
        if (passengerError) throw passengerError;

        console.log('Driver Email:', driverUser.email);
        console.log('Passenger Email:', passengerUser.email);

        // Update passwords
        await supabase.auth.admin.updateUserById(driverId, { password: 'Password123!' });
        await supabase.auth.admin.updateUserById(passengerId, { password: 'Password123!' });

        console.log('Passwords updated to Password123!');
    } catch (e) {
        console.error('Error updating users:', e);
    }
}

update();
