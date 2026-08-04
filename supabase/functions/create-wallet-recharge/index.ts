import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
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

        // 2. Fetch User Details
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

        const keyId = (Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('VITE_RAZORPAY_KEY_ID') || 'rzp_test_TIqp0Gw2vCZY5F').trim()
        const keySecret = (Deno.env.get('RAZORPAY_KEY_SECRET') || 'YMko9rtxgbb032Xb5oTYujPr').trim()

        if (!keyId || !keySecret) {
            throw new Error('Razorpay API keys missing in server configuration')
        }

        // Amount in paise
        const amountInPaise = Math.round(amount * 100)
        const receiptId = `rechg_${String(recharge.id).replace(/-/g, '').substring(0, 16)}`

        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt: receiptId,
                notes: {
                    recharge_id: recharge.id,
                    type: 'wallet_recharge'
                }
            })
        })

        const razorpayData = await razorpayResponse.json()

        if (!razorpayResponse.ok) {
            console.error('Razorpay wallet recharge order creation failed:', razorpayData)
            throw new Error(razorpayData.error?.description || 'Payment order creation failed')
        }

        // Save razorpay_order_id in DB
        await supabaseAdmin
            .from('wallet_recharges')
            .update({ razorpay_order_id: razorpayData.id })
            .eq('id', recharge.id)

        return new Response(
            JSON.stringify({
                success: true,
                key_id: keyId,
                order_id: razorpayData.id,
                amount: razorpayData.amount,
                currency: razorpayData.currency,
                recharge_id: recharge.id,
                prefill: {
                    name: driverDetails.full_name,
                    email: driverDetails.email,
                    contact: driverDetails.phone_number
                }
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
