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

        const token = authHeader.replace(/^Bearer\s+/i, '')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let user: any = null
        const { data: adminUserData, error: adminAuthErr } = await supabaseAdmin.auth.getUser(token)
        if (adminUserData?.user && !adminAuthErr) {
            user = adminUserData.user
        } else {
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            )
            const { data: clientUserData, error: clientAuthErr } = await supabaseClient.auth.getUser()
            if (clientUserData?.user && !clientAuthErr) {
                user = clientUserData.user
            }
        }

        if (!user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const body = await req.json()
        const { payment_id, booking_id, amount: requestedAmount, type } = body

        const keyId = (Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('VITE_RAZORPAY_KEY_ID') || 'rzp_test_TIqp0Gw2vCZY5F').trim()
        const keySecret = (Deno.env.get('RAZORPAY_KEY_SECRET') || 'YMko9rtxgbb032Xb5oTYujPr').trim()

        if (!keyId || !keySecret) {
            return new Response(
                JSON.stringify({ success: false, error: 'Razorpay API credentials missing on server' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        let amountInRupees = 0
        let receiptId = ''
        let finalPaymentId: string | null = null
        let finalRechargeId: string | null = null

        // --- WALLET RECHARGE FLOW ---
        if (type === 'wallet_recharge' || requestedAmount) {
            amountInRupees = Number(requestedAmount)
            if (!amountInRupees || amountInRupees <= 0) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Invalid recharge amount' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }

            const { data: driver } = await supabaseAdmin
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!driver) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Driver profile not found' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                )
            }

            const { data: recharge, error: insertErr } = await supabaseAdmin
                .from('wallet_recharges')
                .insert({
                    driver_id: driver.id,
                    amount: amountInRupees,
                    status: 'pending'
                })
                .select('id')
                .single()

            if (insertErr || !recharge) {
                return new Response(
                    JSON.stringify({ success: false, error: `Failed to create wallet recharge intent: ${insertErr?.message}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                )
            }

            finalRechargeId = recharge.id
            receiptId = `rcpt_rechg_${String(recharge.id).replace(/-/g, '').substring(0, 16)}`

        } else {
            // --- RIDE PAYMENT FLOW ---
            if (!payment_id && !booking_id) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Missing payment_id or booking_id' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }

            let payment: any = null

            if (payment_id) {
                const { data, error } = await supabaseAdmin
                    .from('ride_payments')
                    .select('id, total_amount, payment_status, passenger_id')
                    .eq('id', payment_id)
                    .eq('passenger_id', user.id)
                    .maybeSingle()

                if (error || !data) {
                    return new Response(
                        JSON.stringify({ success: false, error: 'Payment not found or unauthorized' }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                    )
                }
                payment = data
                finalPaymentId = payment.id
            } else if (booking_id) {
                const { data: existingPayment } = await supabaseAdmin
                    .from('ride_payments')
                    .select('id, total_amount, payment_status, passenger_id')
                    .eq('booking_id', booking_id)
                    .eq('passenger_id', user.id)
                    .maybeSingle()

                if (existingPayment) {
                    payment = existingPayment
                    finalPaymentId = payment.id
                } else {
                    // Create payment record for booking
                    const { data: booking, error: bookingErr } = await supabaseAdmin
                        .from('booking_requests')
                        .select('id, passenger_id, seats_requested, trip_id, agreed_price, trips:trip_id(price_per_seat, user_id)')
                        .eq('id', booking_id)
                        .eq('passenger_id', user.id)
                        .single()

                    if (bookingErr || !booking) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Booking not found' }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                        )
                    }

                    const tripData = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips
                    if (!tripData) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Trip data missing' }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                        )
                    }

                    const basePrice = Number(booking.agreed_price) || Number(tripData.price_per_seat || 0)
                    const totalAmount = basePrice * Number(booking.seats_requested || 1)
                    if (!totalAmount || totalAmount <= 0) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Invalid fare total amount' }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                        )
                    }

                    const COMMISSION_RATE = 0.15
                    const commissionAmount = Math.round(totalAmount * COMMISSION_RATE * 100) / 100
                    const driverAmount = Math.round((totalAmount - commissionAmount) * 100) / 100

                    const { data: newPayment, error: insertErr } = await supabaseAdmin
                        .from('ride_payments')
                        .insert({
                            trip_id: booking.trip_id,
                            booking_id: booking.id,
                            passenger_id: booking.passenger_id,
                            driver_id: tripData.user_id,
                            total_amount: totalAmount,
                            commission_amount: commissionAmount,
                            driver_amount: driverAmount,
                            payment_status: 'pending'
                        })
                        .select('id, total_amount, payment_status, passenger_id')
                        .single()

                    if (insertErr || !newPayment) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Failed to create payment record' }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                        )
                    }
                    payment = newPayment
                    finalPaymentId = payment.id
                }
            }

            if (!payment) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Could not resolve payment details' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }

            if (payment.payment_status === 'paid') {
                return new Response(
                    JSON.stringify({ success: false, error: 'Payment is already completed' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                )
            }

            amountInRupees = Number(payment.total_amount)
            receiptId = `rcpt_ride_${String(finalPaymentId).replace(/-/g, '').substring(0, 16)}`
        }

        // Amount in paise
        const amountInPaise = Math.round(amountInRupees * 100)

        // Validate minimum amount requirement (minimum 100 paise = ₹1)
        if (amountInPaise < 100) {
            return new Response(
                JSON.stringify({ success: false, error: 'Minimum payment amount is ₹1 (100 paise)' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Call Razorpay API: POST https://api.razorpay.com/v1/orders
        const authString = btoa(`${keyId}:${keySecret}`)
        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt: receiptId,
                notes: {
                    user_id: user.id,
                    payment_id: finalPaymentId || '',
                    recharge_id: finalRechargeId || ''
                }
            })
        })

        const razorpayOrder = await razorpayResponse.json()

        if (!razorpayResponse.ok) {
            console.error('Razorpay API order error:', razorpayOrder)
            return new Response(
                JSON.stringify({ success: false, error: razorpayOrder.error?.description || 'Razorpay order creation failed' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        // Save razorpay_order_id / cashfree_order_id in DB for status tracking
        if (finalPaymentId) {
            await supabaseAdmin
                .from('ride_payments')
                .update({ cashfree_order_id: razorpayOrder.id })
                .eq('id', finalPaymentId)
        } else if (finalRechargeId) {
            await supabaseAdmin
                .from('wallet_recharges')
                .update({ cashfree_order_id: razorpayOrder.id })
                .eq('id', finalRechargeId)
        }

        return new Response(
            JSON.stringify({
                success: true,
                order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key_id: keyId,
                payment_id: finalPaymentId,
                recharge_id: finalRechargeId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (err) {
        const error = err as Error
        console.error('create-razorpay-order function error:', error.message)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
});
