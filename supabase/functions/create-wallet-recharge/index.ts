import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { amount } = await req.json()
        if (!amount || amount <= 0) throw new Error('Invalid amount')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Find Driver Profile
        const { data: driver, error: driverErr } = await supabaseAdmin
            .from('drivers')
            .select('id')
            .eq('user_id', user.id)
            .single()

        if (driverErr || !driver) throw new Error('Driver profile not found')

        // 2. Fetch User Details for Cashfree
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('phone_number, full_name, email')
            .eq('id', user.id)
            .single()
            
        const driverDetails = {
            phone_number: profile?.phone_number || user.phone,
            full_name: profile?.full_name || 'Driver',
            email: profile?.email || user.email || 'driver@xpool.com'
        }

        // 3. Create wallet_recharges intent record
        const { data: recharge, error: insertErr } = await supabaseAdmin
            .from('wallet_recharges')
            .insert({
                driver_id: driver.id,
                amount: amount,
                status: 'pending'
            })
            .select('id')
            .single();

        if (insertErr || !recharge) throw new Error(`DB Error: ${insertErr?.message}`)

        const appId = (Deno.env.get('CASHFREE_APP_ID') || '').trim()
        const secretKey = (Deno.env.get('CASHFREE_SECRET_KEY') || '').trim()
        const env = (Deno.env.get('CASHFREE_ENV') || 'PRODUCTION').trim()

        if (!appId || !secretKey) {
            // Stub mode
            console.warn('CASHFREE API keys missing, running in stub mode')
            return new Response(
                JSON.stringify({
                    success: true,
                    stub_mode: true,
                    payment_session_id: 'dummy_session_id',
                    order_id: `rechg_stub_${recharge.id}`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const baseUrl = env === 'PRODUCTION'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg'

        // Prefix order ID with rechg_ so the webhook routes it properly!
        const orderId = `rechg_${String(recharge.id).replace(/-/g, '').substring(0, 16)}_${Date.now()}`

        // Create new order
        const requestBody = {
            order_id: orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
                customer_id: user.id.replace(/-/g, ''), // Cashfree prefers alphanumeric
                customer_phone: (driverDetails.phone_number?.replace(/\D/g, '').slice(-10)) || '9999999999',
                customer_name: driverDetails.full_name,
                customer_email: driverDetails.email
            },
            order_meta: {
                return_url: (() => {
                    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://xpool.app';
                    const safeUrl = siteUrl.replace(/^http:\/\//, 'https://');
                    return `${safeUrl}/driver/wallet`;
                })()
            }
        }

        const response = await fetch(`${baseUrl}/orders`, {
            method: 'POST',
            headers: {
                'x-api-version': '2023-08-01',
                'x-client-id': appId,
                'x-client-secret': secretKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })

        const cashfreeData = await response.json()

        if (!response.ok) {
            console.error('Cashfree order creation failed:', cashfreeData)
            throw new Error(cashfreeData.message || 'Payment gateway error')
        }

        // Save new order_id in DB
        await supabaseAdmin
            .from('wallet_recharges')
            .update({ cashfree_order_id: orderId })
            .eq('id', recharge.id)

        return new Response(
            JSON.stringify({
                success: true,
                payment_session_id: cashfreeData.payment_session_id,
                order_id: orderId,
                recharge_id: recharge.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (err) {
        const error = err as Error;
        console.error('Function Error:', error.message)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
