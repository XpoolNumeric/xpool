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

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { payment_id, booking_id } = await req.json()
        if (!payment_id && !booking_id) {
            throw new Error('Missing required fields: payment_id or booking_id')
        }

        // 1. Fetch payment record safely
        let paymentQuery = supabaseAdmin.from('ride_payments').select('id, payment_status, driver_id, passenger_id, trip_id, commission_amount').eq('driver_id', user.id)
        if (payment_id) {
            paymentQuery = paymentQuery.eq('id', payment_id)
        } else {
            paymentQuery = paymentQuery.eq('booking_id', booking_id)
        }

        const { data: maybePayment, error: paymentError } = await paymentQuery.maybeSingle()
        if (paymentError) throw new Error('Query error: ' + JSON.stringify(paymentError))
        
        let paymentId = maybePayment?.id;

        // If payment doesn't exist AND we are verifying by booking_id (COD case), we CREATE IT!
        if (!maybePayment && booking_id) {
            // Fetch booking details to calculate amounts
            const { data: booking, error: bookingErr } = await supabaseAdmin
                .from('booking_requests')
                .select(`
                    id, passenger_id, seats_requested, trip_id, driver_id,
                    trips:trip_id(price_per_seat, user_id)
                `)
                .eq('id', booking_id)
                .single()
            
            if (bookingErr || !booking) throw new Error('Booking not found while creating payment record')
            
            // Verify driver ownership
            if (booking.driver_id !== user.id && (Array.isArray(booking.trips) ? booking.trips[0] : booking.trips)?.user_id !== user.id) {
                throw new Error('Unauthorized to verify this payment')
            }

            const tripData = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
            const totalAmount = Number(tripData.price_per_seat || 0) * Number(booking.seats_requested || 1);
            const COMMISSION_RATE = 0.15;
            const commissionAmount = Math.round(totalAmount * COMMISSION_RATE * 100) / 100;
            const driverAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;

            const { data: newPayment, error: insertErr } = await supabaseAdmin
                .from('ride_payments')
                .insert({
                    trip_id: booking.trip_id,
                    booking_id: booking.id,
                    passenger_id: booking.passenger_id,
                    driver_id: user.id,
                    total_amount: totalAmount,
                    commission_amount: commissionAmount,
                    driver_amount: driverAmount,
                    payment_status: 'paid', // directly marking as paid since they clicked Verify Cash
                    paid_at: new Date().toISOString()
                })
                .select('id, payment_status, driver_id, passenger_id, trip_id')
                .single()
            
            if (insertErr || !newPayment) throw new Error('Failed to create cash payment record: ' + insertErr?.message)
            
            paymentId = newPayment.id; // Just created and marked paid

            // --> DEDUCT COMMISSION <--
            try {
                // Ensure driver record exists first
                const { data: driverExists } = await supabaseAdmin.from('drivers').select('id').eq('user_id', user.id).maybeSingle();
                if (!driverExists) {
                    await supabaseAdmin.from('drivers').insert({ user_id: user.id, status: 'approved' });
                }

                const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('deduct_commission_and_check_wallet', {
                    p_driver_user_id: user.id,
                    p_amount: commissionAmount,
                    p_ride_id: booking.trip_id,
                    p_description: 'Commission Deducted for Cash Trip (Verify Flow)'
                });
                if (rpcErr) console.error('Wallet deduction RPC error:', rpcErr);
                else console.log('Commission deducted successfully:', rpcData);
            } catch (err) {
                console.error('Wallet deduction threw error:', err);
            }

        } else if (!maybePayment) {
            throw new Error('Payment record not found')
        } else {
            // Record exists, update status
            if (maybePayment.payment_status === 'paid') {
               return new Response(JSON.stringify({ success: true, message: 'Already marked as paid.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            // Update payment status to paid (Cash)
            const { error: updateError } = await supabaseAdmin
                .from('ride_payments')
                .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
                .eq('id', maybePayment.id)

            if (updateError) throw updateError;
            paymentId = maybePayment.id;

            // --> DEDUCT COMMISSION <--
            const comAmount = Number(maybePayment.commission_amount || 0);
            if (comAmount > 0) {
                try {
                    // Ensure driver record exists first
                    const { data: driverExists } = await supabaseAdmin.from('drivers').select('id').eq('user_id', user.id).maybeSingle();
                    if (!driverExists) {
                        await supabaseAdmin.from('drivers').insert({ user_id: user.id, status: 'approved' });
                    }

                    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('deduct_commission_and_check_wallet', {
                        p_driver_user_id: user.id,
                        p_amount: comAmount,
                        p_ride_id: maybePayment.trip_id,
                        p_description: 'Commission Deducted for Cash Trip (Verify Flow)'
                    });
                    if (rpcErr) console.error('Wallet deduction RPC error:', rpcErr);
                    else console.log('Commission deducted successfully:', rpcData);
                } catch (err) {
                    console.error('Wallet deduction threw error:', err);
                }
            }
        }

        // 3. (Optional) Broadcast to passenger that payment is received
        // Try getting passenger_id and trip_id again just in case we created it.
        const activePassengerId = maybePayment?.passenger_id;
        const activeTripId = maybePayment?.trip_id;
        if (activePassengerId) {
            try {
                const channel = supabaseAdmin.channel(`passenger_${activePassengerId}`)
                await channel.send({
                    type: 'broadcast',
                    event: 'payment_received',
                    payload: { trip_id: activeTripId, message: 'Driver confirmed cash payment!' }
                })
                supabaseAdmin.removeChannel(channel)
            } catch (bErr) { console.error('Broadcast error:', bErr) }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Payment verified successfully.'
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
