// Script to set FIREBASE_SERVICE_ACCOUNT secret via Supabase Management API
// Run: node set_firebase_secret.mjs

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

const PROJECT_REF = 'zuppuxrammhisswduryw';

// Read the service account JSON
const saKey = JSON.parse(readFileSync('./scratch/firebase-sa-key.json', 'utf8'));
// Convert to single-line JSON string (required for env var storage)
const saKeyStr = JSON.stringify(saKey);

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter your Supabase ACCESS TOKEN (from https://supabase.com/dashboard/account/tokens): ', async (accessToken) => {
  rl.close();

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`;

  console.log('\nSetting FIREBASE_SERVICE_ACCOUNT secret...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        name: 'FIREBASE_SERVICE_ACCOUNT',
        value: saKeyStr,
      }
    ]),
  });

  if (response.ok) {
    console.log('\n✅ SUCCESS! FIREBASE_SERVICE_ACCOUNT secret has been set in Supabase.');
    console.log('Next step: Deploy the edge function with:');
    console.log(`  npx supabase functions deploy send-push-notification --project-ref ${PROJECT_REF}`);
  } else {
    const err = await response.text();
    console.error('\n❌ FAILED:', response.status, err);
    console.log('\nMake sure your access token is correct.');
    console.log('Get it from: https://supabase.com/dashboard/account/tokens');
  }
});
