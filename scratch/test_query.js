import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:\\xpool', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { data: tripsList, error } = await supabase
      .from('trips')
      .select('*, booking_requests(*, ride_payments(*))')
      .in('status', ['completed'])
      .order('created_at', { ascending: false })
      .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', JSON.stringify(tripsList, null, 2));
  }
}

testQuery();
