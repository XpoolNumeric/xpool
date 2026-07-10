import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.resolve('d:\\xpool', '.env'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
      .from('trips')
      .select('*, booking_requests(*)')
      .in('status', ['completed'])
      .order('created_at', { ascending: false })
      .limit(1);
      
  console.log(JSON.stringify(data, null, 2));
}

test();
