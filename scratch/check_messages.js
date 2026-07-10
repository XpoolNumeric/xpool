import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching one message...");
    const { data: messages, error } = await supabase.from('messages').select('*').limit(1);
    if (error) {
        console.error("Error fetching messages:", error);
    } else {
        console.log("Message structure:", messages);
    }
}

check();
