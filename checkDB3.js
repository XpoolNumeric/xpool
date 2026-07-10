import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: drivers } = await supabase.from('drivers').select('*');
    fs.writeFileSync('drivers_out.json', JSON.stringify({drivers}, null, 2));
    console.log("Done");
}

check();
