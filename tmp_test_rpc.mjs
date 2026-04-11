import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("No supabase credentials found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('search_trips', {
      search_from: 'chennai',
      search_to: 'delhi',
      search_date: null,
      vehicle_pref: 'any',
      page_number: 1,
      page_size: 20
  });
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data) {
     console.log("Data:", JSON.stringify(data, null, 2));
  }
}
main();
