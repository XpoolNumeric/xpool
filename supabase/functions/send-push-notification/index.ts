import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Firebase Service Account Config (Loaded from environment or using the provided fallback)
const SERVICE_ACCOUNT_FALLBACK = {
  "type": "service_account",
  "project_id": "xpool-7f090",
  "private_key_id": "",
  "private_key": "",
  "client_email": "firebase-adminsdk-fbsvc@xpool-7f090.iam.gserviceaccount.com",
  "client_id": "",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40xpool-7f090.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

function getServiceAccount() {
  const envVal = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (envVal) {
    try {
      return JSON.parse(envVal);
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e);
    }
  }
  return SERVICE_ACCOUNT_FALLBACK;
}

// Helper to base64url encode strings and buffers
function base64UrlEncode(str: string | Uint8Array): string {
  let binary = "";
  if (typeof str === "string") {
    binary = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } else {
    const len = str.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(str[i]);
    }
    binary = btoa(binary);
  }
  return binary.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Convert PEM format key to CryptoKey
function pemToBinary(pem: string): Uint8Array {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryStr = atob(clean);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const binary = pemToBinary(pem);
  return await crypto.subtle.importKey(
    "pkcs8",
    binary,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["sign"]
  );
}

// Obtain Google OAuth2 access token for FCM
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const privateKey = await importPrivateKey(serviceAccount.private_key);
  
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(tokenInput)
  );
  
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  const assertion = `${tokenInput}.${encodedSignature}`;
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertion
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get OAuth token: ${errText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceAccount = getServiceAccount();
    const projectId = serviceAccount.project_id;

    // Initialize Admin Client for DB Operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse the Webhook Payload
    const webhookData = await req.json()
    console.log('[Push Webhook] Received event:', webhookData)

    const { type, table, record } = webhookData

    // We only process INSERTs on the notifications table
    if (type !== 'INSERT' || table !== 'notifications' || !record) {
      return new Response(JSON.stringify({ success: true, message: 'Ignored non-INSERT or unrelated table event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const { user_id, title, message, data: payloadData, type: notifType, reference_id } = record

    if (!user_id || (!title && !message)) {
      throw new Error('Notification record is missing user_id, title, or message')
    }

    // 2. Fetch FCM tokens for the recipient user
    const { data: tokenRecords, error: tokenError } = await supabaseAdmin
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', user_id)

    if (tokenError) {
      throw tokenError
    }

    if (!tokenRecords || tokenRecords.length === 0) {
      console.log(`[Push Webhook] No FCM tokens registered for user: ${user_id}`)
      return new Response(JSON.stringify({ success: true, message: 'No registered tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 3. Authenticate with Google / Firebase
    const accessToken = await getFcmAccessToken(serviceAccount)
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    // Flatten and convert payload custom data properties to string values (required by FCM data payload)
    const customData: Record<string, string> = {}
    if (payloadData && typeof payloadData === 'object') {
      for (const [key, val] of Object.entries(payloadData)) {
        customData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val)
      }
    }
    if (record.id) customData.notification_id = String(record.id)
    if (notifType) customData.type = String(notifType)
    if (reference_id) customData.reference_id = String(reference_id)

    const sendPromises = tokenRecords.map(async (tokenRecord) => {
      const fcmToken = tokenRecord.fcm_token
      
      const payload = {
        message: {
          token: fcmToken,
          notification: {
            title: title || 'xPool Notification',
            body: message || ''
          },
          data: customData,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              click_action: 'FCM_PLUGIN_ACTIVITY'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                alert: {
                  title: title || 'xPool Notification',
                  body: message || ''
                }
              }
            }
          }
        }
      }

      console.log(`[Push Webhook] Dispatching notification to token: ${fcmToken.substring(0, 15)}...`)
      
      const fcmResponse = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!fcmResponse.ok) {
        const errorText = await fcmResponse.text()
        console.error(`[Push Webhook] FCM dispatch failed for token ${fcmToken.substring(0, 10)}...:`, errorText)

        // Delete stale/invalid tokens automatically (HTTP 404 or 410 represent unregistered devices)
        if (fcmResponse.status === 404 || fcmResponse.status === 410) {
          console.log(`[Push Webhook] Removing invalid FCM token: ${fcmToken.substring(0, 15)}...`)
          await supabaseAdmin
            .from('user_fcm_tokens')
            .delete()
            .eq('fcm_token', fcmToken)
        }
        return { token: fcmToken, success: false, status: fcmResponse.status }
      }

      const responseJson = await fcmResponse.json()
      console.log(`[Push Webhook] Dispatch success for token:`, responseJson)
      return { token: fcmToken, success: true }
    })

    const results = await Promise.all(sendPromises)

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error("[Push Webhook Exception]:", error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
