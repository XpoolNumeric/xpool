import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zuppuxrammhisswduryw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cHB1eHJhbW1oaXNzd2R1cnl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjU5NiwiZXhwIjoyMDgzNzg4NTk2fQ.46zuFluarw0Wf7ey5SdS1xFoHtb-kJOcOZC03-edjAg'
)

async function test() {
  const { data, error } = await supabase.from('trips').select('*').limit(5);
  if (error) {
    console.error(error);
  } else {
    data.forEach(trip => {
        console.log(`Trip ${trip.id}: start_lat=${trip.start_lat}, start_lng=${trip.start_lng}, from=${trip.from_location}`);
    });
  }
}

test();
