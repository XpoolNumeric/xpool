import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*, trips(id, price_per_seat, from_location)')
    .order('created_at', {ascending: false})
    .limit(2);
  
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

test();
