import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MSG91_AUTHKEY = Deno.env.get('MSG91_AUTHKEY') ?? '';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { phone, otp } = await req.json();

        if (!phone || !otp) {
            return new Response(
                JSON.stringify({ error: 'Phone and OTP are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Strip leading + for MSG91
        const mobile = phone.startsWith('+') ? phone.slice(1) : phone;

        // MSG91 v5 OTP Verify API
        const url = `https://api.msg91.com/api/v5/otp/verify?authkey=${MSG91_AUTHKEY}&mobile=${mobile}&otp=${otp}`;

        const msg91Response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const msg91Data = await msg91Response.json();
        console.log('[verify-phone-otp] MSG91 response:', msg91Data);

        // MSG91 returns { type: "success", message: "Mobile No. Verified Successfully" } on success
        if (msg91Data.type === 'success') {
            return new Response(
                JSON.stringify({ success: true, message: 'Phone number verified successfully' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ error: msg91Data.message || 'Invalid OTP' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } catch (error) {
        console.error('[verify-phone-otp] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
