import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

function parseEnv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const env = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const parts = trimmed.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim();
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const rootEnv = parseEnv('./.env');
const adminEnv = parseEnv('./xpooladminpanel-main/.env');

const supabaseUrl = rootEnv.VITE_SUPABASE_URL || adminEnv.VITE_SUPABASE_URL;
const serviceRoleKey = adminEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testExecSql() {
    console.log("Testing common RPC names for executing SQL...");
    const rpcNames = ['exec_sql', 'execute_sql', 'run_sql', 'exec', 'query'];
    
    for (const name of rpcNames) {
        try {
            const { data, error } = await supabase.rpc(name, { sql: "SELECT 1 as val" });
            if (!error) {
                console.log(`✅ Found functioning RPC: ${name}`, data);
                return;
            } else {
                console.log(`❌ RPC ${name} failed:`, error.message);
            }
        } catch (e) {
            console.log(`❌ RPC ${name} error:`, e.message);
        }
    }
    console.log("No common SQL execution RPCs found.");
}

testExecSql();
