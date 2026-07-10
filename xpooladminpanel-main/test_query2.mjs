import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zuppuxrammhisswduryw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cHB1eHJhbW1oaXNzd2R1cnl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjU5NiwiZXhwIjoyMDgzNzg4NTk2fQ.46zuFluarw0Wf7ey5SdS1xFoHtb-kJOcOZC03-edjAg'
)

async function test() {
  const { data, error } = await supabase.from('trips').select(`
      *,
      profiles (full_name)
  `).limit(1);
  
  console.log("Error profiles:", error?.message);
  
  const { data: d2, error: e2 } = await supabase.from('trips').select(`
      *,
      user_id
  `).limit(1);
  console.log("Error user_id:", e2?.message);
  console.log("Data user_id:", d2);
  
  // Actually, wait, let's see if drivers can be joined since drivers also references auth.users maybe? Or maybe trips.driver_id references drivers.id
    const { data: d3, error: e3 } = await supabase.from('trips').select(`
      *,
      drivers (full_name)
  `).limit(1);
  console.log("Error drivers:", e3?.message);
}

test();
