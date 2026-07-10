import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read from .env if possible or hardcode if we can find it
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("No supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: drivers } = await supabase.from('drivers').select('*').limit(5);
  console.log("Drivers:", drivers?.map(d => d.id));

  const { data: trips } = await supabase.from('trips').select('*').limit(5);
  console.log("Trips count:", trips?.length);

  const { data: payments, error } = await supabase.from('ride_payments').select('*').limit(10);
  console.log("Ride payments:", payments?.length, error);
  if (payments?.length > 0) {
      console.log("First payment driver:", payments[0].driver_id);
  }

  const { data: wallets } = await supabase.from('driver_wallets').select('*').limit(5);
  console.log("Wallets:", wallets?.length);
}

check();
