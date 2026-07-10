import fetch from 'node-fetch';
import fs from 'fs';

let envStr = fs.readFileSync('admin/.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
    const swagger = await res.json();
    fs.writeFileSync('swagger.json', JSON.stringify(swagger, null, 2));
    console.log("Written swagger.json");
}

check();
