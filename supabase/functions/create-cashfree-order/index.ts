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

        const { payment_id, booking_id } = await req.json()
        if (!payment_id && !booking_id) throw new Error('Missing payment_id or booking_id')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let payment;
        let finalPaymentId = payment_id;

        if (payment_id) {
            // Fetch payment details by payment_id
            const { data, error } = await supabaseAdmin
                .from('ride_payments')
                .select(`
                    id, total_amount, payment_status, cashfree_order_id, passenger_id
                `)
                .eq('id', payment_id)
                .eq('passenger_id', user.id)
                .single()
            if (error || !data) throw new Error('Payment not found or unauthorized')
            payment = data;
        } else if (booking_id) {
            // Look up by booking_id
            const { data: existingPayment, error: existingError } = await supabaseAdmin
                .from('ride_payments')
                .select(`
                    id, total_amount, payment_status, cashfree_order_id, passenger_id
                `)
                .eq('booking_id', booking_id)
                .eq('passenger_id', user.id)
                .maybeSingle()
            
            if (existingError) throw new Error('Payment DB Error: ' + JSON.stringify(existingError))

            if (existingPayment) {
                payment = existingPayment;
                finalPaymentId = payment.id;
            } else {
                // We need to create the payment record
                // 1. Get booking and trip details
                const { data: booking, error: bookingErr } = await supabaseAdmin
                    .from('booking_requests')
                    .select(`
                        id, passenger_id, seats_requested, trip_id,
                        trips:trip_id(price_per_seat, user_id)
                    `)
                    .eq('id', booking_id)
                    .eq('passenger_id', user.id)
                    .single()
                
                if (bookingErr) throw new Error('DB Error: ' + JSON.stringify(bookingErr))
                if (!booking) throw new Error('Booking not found in DB')
                
                // Supabase might return relations as arrays depending on schema definitions.
                const tripData = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
                if (!tripData) throw new Error('Trip data not found');

                const totalAmount = Number(tripData.price_per_seat || 0) * Number(booking.seats_requested || 1);
                if (!totalAmount || totalAmount <= 0) throw new Error('Invalid total amount: ' + totalAmount);

                const COMMISSION_RATE = 0.15;
                const commissionAmount = Math.round(totalAmount * COMMISSION_RATE * 100) / 100
                const driverAmount = Math.round((totalAmount - commissionAmount) * 100) / 100
                
                // 2. Create payment record
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
                    .select(`
                        id, total_amount, payment_status, cashfree_order_id, passenger_id
                    `)
                    .single()
                
                if (insertErr || !newPayment) throw new Error('Failed to create payment record')
                payment = newPayment;
                finalPaymentId = payment.id;
            }
        }

        if (!payment) throw new Error('Could not resolve payment details')
        if (payment.payment_status === 'paid') throw new Error('Already paid')

        const appId = Deno.env.get('CASHFREE_APP_ID') || ''
        const secretKey = Deno.env.get('CASHFREE_SECRET_KEY') || ''
        const env = Deno.env.get('CASHFREE_ENV') || 'PRODUCTION'

        if (!appId || !secretKey) {
            // Stub mode if keys are missing
            console.warn('CASHFREE API keys missing, running in stub mode')
            return new Response(
                JSON.stringify({
                    success: true,
                    stub_mode: true,
                    payment_session_id: 'dummy_session_id',
                    order_id: `stub_order_${Date.now()}`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const baseUrl = env === 'PRODUCTION'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg'

        // If order exists, fetch existing session if not expired, or create new
        const orderId = payment.cashfree_order_id || `order_${String(finalPaymentId).replace(/-/g, '').substring(0, 16)}_${Date.now()}`

        // Fetch passenger info from profiles separately to avoid FK join issues
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('phone_number, full_name, email')
            .eq('id', user.id)
            .single()

        const passengerDetails = {
            phone_number: profile?.phone_number || user.phone,
            full_name: profile?.full_name || 'Passenger',
            email: profile?.email || user.email || 'passenger@xpool.com'
        }

        // Create new order
        const requestBody = {
            order_id: orderId,
            order_amount: payment.total_amount,
            order_currency: 'INR',
            customer_details: {
                customer_id: user.id.replace(/-/g, ''), // Cashfree prefers alphanumeric
                customer_phone: (passengerDetails.phone_number?.replace(/\D/g, '').slice(-10)) || '9999999999',
                customer_name: passengerDetails.full_name,
                customer_email: passengerDetails.email
            },
            order_meta: {
                return_url: (() => {
                    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://xpool.app';
                    // Cashfree production requires HTTPS
                    const safeUrl = siteUrl.replace(/^http:\/\//, 'https://');
                    return `${safeUrl}/payment-status?order_id={order_id}`;
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

        // Save order_id in DB
        if (!payment.cashfree_order_id) {
            await supabaseAdmin
                .from('ride_payments')
                .update({ cashfree_order_id: orderId })
                .eq('id', finalPaymentId)
        }

        return new Response(
            JSON.stringify({
                success: true,
                payment_session_id: cashfreeData.payment_session_id,
                order_id: orderId,
                payment_id: finalPaymentId
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
