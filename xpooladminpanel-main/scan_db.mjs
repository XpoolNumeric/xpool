import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zuppuxrammhisswduryw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cHB1eHJhbW1oaXNzd2R1cnl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjU5NiwiZXhwIjoyMDgzNzg4NTk2fQ.46zuFluarw0Wf7ey5SdS1xFoHtb-kJOcOZC03-edjAg'
)

async function test() {
  const { data, error } = await supabase.rpc('get_tables'); // Some standard RPC?
  // If not, we can try to query information_schema or just check common ones.
  const tables = ['trips', 'booking_requests', 'profiles', 'drivers', 'vehicles', 'ride_payments', 'logs', 'settings', 'withdrawal_requests', 'trip_locations'];
  for (const table of tables) {
     const { data, error } = await supabase.from(table).select('*').limit(1);
     if (!error) {
        console.log(`Table exists: ${table}. Columns:`, data.length > 0 ? Object.keys(data[0]) : 'Empty');
     }
  }
}

test();
