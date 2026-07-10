import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zuppuxrammhisswduryw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cHB1eHJhbW1oaXNzd2R1cnl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjU5NiwiZXhwIjoyMDgzNzg4NTk2fQ.46zuFluarw0Wf7ey5SdS1xFoHtb-kJOcOZC03-edjAg'
)

const COORDINATES = {
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'tanjore': { lat: 10.7852, lng: 79.1318 },
  'gingee': { lat: 12.2530, lng: 79.4184 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'salem': { lat: 11.6643, lng: 78.1460 },
  'puducherry': { lat: 11.9416, lng: 79.8083 }
}

async function seed() {
  const { data: trips, error } = await supabase.from('trips').select('*')
  if (error) {
    console.error(error);
    return;
  }

  for (const trip of trips) {
    const from_lower = trip.from_location?.toLowerCase() || '';
    const to_lower = trip.to_location?.toLowerCase() || '';
    
    let updates = {};
    
    // Find matching coordinates for 'from'
    for (const city in COORDINATES) {
      if (from_lower.includes(city)) {
          updates.start_lat = COORDINATES[city].lat;
          updates.start_lng = COORDINATES[city].lng;
      }
      if (to_lower.includes(city)) {
          updates.end_lat = COORDINATES[city].lat;
          updates.end_lng = COORDINATES[city].lng;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('trips').update(updates).eq('id', trip.id);
      if (updateError) {
        console.error(`Failed to update trip ${trip.id}:`, updateError);
      } else {
        console.log(`Updated trip ${trip.id} with coordinates for ${trip.from_location} to ${trip.to_location}`);
      }
    }
  }
  console.log("Seeding complete!");
}

seed();
