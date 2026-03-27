import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MSG91_AUTHKEY = Deno.env.get('MSG91_AUTHKEY') ?? '';
const MSG91_TEMPLATE_ID = Deno.env.get('MSG91_TEMPLATE_ID') ?? '';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { phone } = await req.json();

        if (!phone) {
            return new Response(
                JSON.stringify({ error: 'Phone number is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Strip leading + for MSG91 (it expects 91XXXXXXXXXX format)
        const mobile = phone.startsWith('+') ? phone.slice(1) : phone;

        // MSG91 v5 OTP Send API — OTP is auto-generated & stored by MSG91
        const url = `https://api.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${mobile}&authkey=${MSG91_AUTHKEY}`;

        const msg91Response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const msg91Data = await msg91Response.json();
        console.log('[send-phone-otp] MSG91 response:', msg91Data);

        // MSG91 returns { type: "success", message: "3762786569..." } on success
        if (msg91Data.type === 'success' || msg91Data.type === 'success-request') {
            return new Response(
                JSON.stringify({ success: true, message: 'OTP sent successfully' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ error: msg91Data.message || 'Failed to send OTP' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } catch (error) {
        console.error('[send-phone-otp] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
