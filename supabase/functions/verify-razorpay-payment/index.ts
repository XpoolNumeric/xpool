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
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing Authorization header' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const body = await req.json()
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_id, recharge_id, booking_id } = body

        // Validate required signature verification fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required signature verification parameters' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const keySecret = (Deno.env.get('RAZORPAY_KEY_SECRET') || 'YMko9rtxgbb032Xb5oTYujPr').trim()
        if (!keySecret) {
            return new Response(
                JSON.stringify({ success: false, error: 'Razorpay secret key not configured on server' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        // HMAC-SHA256 Verification: razorpay_order_id + "|" + razorpay_payment_id
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(keySecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        )

        const dataToSign = `${razorpay_order_id}|${razorpay_payment_id}`
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(dataToSign))
        const generatedSignature = Array.from(new Uint8Array(sigBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        if (generatedSignature !== razorpay_signature) {
            console.error('Razorpay signature mismatch! Expected:', generatedSignature, 'Received:', razorpay_signature)
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid payment signature' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Signature verified successfully! Now mark payment as paid in database.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // --- CHECK IF WALLET RECHARGE ---
        let isRecharge = !!recharge_id
        if (!isRecharge && razorpay_order_id) {
            const { data: rechargeCheck } = await supabaseAdmin
                .from('wallet_recharges')
                .select('id')
                .eq('cashfree_order_id', razorpay_order_id)
                .maybeSingle()
            if (rechargeCheck) isRecharge = true
        }

        if (isRecharge) {
            let rechargeQuery = supabaseAdmin.from('wallet_recharges').select('*')
            if (recharge_id) {
                rechargeQuery = rechargeQuery.eq('id', recharge_id)
            } else {
                rechargeQuery = rechargeQuery.eq('cashfree_order_id', razorpay_order_id)
            }

            const { data: recharge, error: rechgError } = await rechargeQuery.maybeSingle()
            if (rechgError || !recharge) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Recharge record not found' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                )
            }

            if (recharge.status === 'paid') {
                return new Response(
                    JSON.stringify({ success: true, is_paid: true, message: 'Recharge already processed' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                )
            }

            // Update status
            await supabaseAdmin
                .from('wallet_recharges')
                .update({
                    status: 'paid',
                    cashfree_payment_id: razorpay_payment_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', recharge.id)

            // Credit driver wallet
            const { data: driver } = await supabaseAdmin
                .from('drivers')
                .select('user_id')
                .eq('id', recharge.driver_id)
                .single()

            if (driver) {
                try {
                    await supabaseAdmin.rpc('add_to_wallet', {
                        p_driver_user_id: driver.user_id,
                        p_amount: recharge.amount,
                        p_ride_id: recharge.id,
                        p_description: 'Wallet Top-up Complete'
                    })

                    await supabaseAdmin.from('notifications').insert({
                        user_id: driver.user_id,
                        type: 'wallet_recharge',
                        title: 'Funds Added!',
                        message: `Successfully added ₹${recharge.amount} to your wallet via Razorpay.`,
                        data: { recharge_id: recharge.id }
                    })
                } catch (walletErr) {
                    console.error('Wallet recharge credit RPC error:', walletErr)
                }
            }

            return new Response(
                JSON.stringify({ success: true, is_paid: true, message: 'Wallet recharge verified and credited successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )

        } else {
            // --- RIDE PAYMENT FLOW ---
            let paymentQuery = supabaseAdmin.from('ride_payments').select('*')
            if (payment_id) {
                paymentQuery = paymentQuery.eq('id', payment_id)
            } else if (booking_id) {
                paymentQuery = paymentQuery.eq('booking_id', booking_id)
            } else {
                paymentQuery = paymentQuery.eq('cashfree_order_id', razorpay_order_id)
            }

            const { data: payment, error: pmError } = await paymentQuery.maybeSingle()

            if (pmError || !payment) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Ride payment record not found' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                )
            }

            if (payment.payment_status === 'paid') {
                return new Response(
                    JSON.stringify({ success: true, is_paid: true, message: 'Payment already processed' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                )
            }

            // Update payment status
            await supabaseAdmin
                .from('ride_payments')
                .update({
                    payment_status: 'paid',
                    cashfree_payment_id: razorpay_payment_id,
                    paid_at: new Date().toISOString()
                })
                .eq('id', payment.id)

            // Update booking status if booking_id exists
            const actualBookingId = booking_id || payment.booking_id
            if (actualBookingId) {
                await supabaseAdmin
                    .from('booking_requests')
                    .update({ status: 'completed', drop_status: 'completed', payment_mode: 'online' })
                    .eq('id', actualBookingId)
            }

            // Credit driver wallet
            try {
                await supabaseAdmin.rpc('add_to_wallet', {
                    p_driver_user_id: payment.driver_id,
                    p_amount: payment.driver_amount,
                    p_ride_id: payment.trip_id,
                    p_description: 'Online payment earning (after 15% commission)'
                })

                await supabaseAdmin.from('notifications').insert({
                    user_id: payment.driver_id,
                    type: 'payment_received',
                    title: 'Payment Received!',
                    message: `Passenger paid ₹${payment.total_amount}. Added ₹${payment.driver_amount} to your wallet.`,
                    data: { trip_id: payment.trip_id, payment_id: payment.id }
                })
            } catch (walletErr) {
                console.error('Driver wallet credit RPC error:', walletErr)
            }

            return new Response(
                JSON.stringify({ success: true, is_paid: true, message: 'Payment signature verified successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

    } catch (err) {
        const error = err as Error
        console.error('verify-razorpay-payment function error:', error.message)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
});
