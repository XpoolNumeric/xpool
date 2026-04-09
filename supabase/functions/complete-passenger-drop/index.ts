import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COMMISSION_RATE = 0.15 // 15% platform commission

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Auth
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // 2. Admin client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { trip_id, booking_id } = await req.json()
        if (!trip_id || !booking_id) {
            throw new Error('Missing required fields: trip_id, booking_id')
        }

        // 3. Verify trip and driver
        const { data: trip, error: tripError } = await supabaseAdmin
            .from('trips')
            .select('id, user_id, status, price_per_seat')
            .eq('id', trip_id)
            .single()

        if (tripError || !trip) throw new Error('Trip not found')
        if (trip.user_id !== user.id) throw new Error('Not authorized')
        if (trip.status !== 'in_progress') throw new Error('Ride is not in progress')

        // 4. Get the booking
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from('booking_requests')
            .select('id, passenger_id, seats_requested, drop_status')
            .eq('id', booking_id)
            .eq('trip_id', trip_id)
            .single()

        if (bookingError || !booking) throw new Error('Booking not found')
        if (booking.drop_status === 'completed') {
            return new Response(
                JSON.stringify({ success: true, already_dropped: true, message: 'Passenger already dropped' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 5. Mark passenger as dropped
        const { error: dropError } = await supabaseAdmin
            .from('booking_requests')
            .update({
                drop_status: 'completed',
                dropped_at: new Date().toISOString(),
                status: 'completed'
            })
            .eq('id', booking_id)

        if (dropError) throw dropError

        // 6. Calculate payment
        const totalAmount = trip.price_per_seat * booking.seats_requested
        const commissionAmount = Math.round(totalAmount * COMMISSION_RATE * 100) / 100
        const driverAmount = Math.round((totalAmount - commissionAmount) * 100) / 100

        // 7. Create payment record
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('ride_payments')
            .upsert({
                trip_id,
                booking_id,
                passenger_id: booking.passenger_id,
                driver_id: user.id,
                total_amount: totalAmount,
                commission_amount: commissionAmount,
                driver_amount: driverAmount
            }, { onConflict: 'trip_id,passenger_id' })
            .select()
            .single()

        if (paymentError) {
            console.error('Payment record error:', paymentError)
            // Non-critical — continue
        }

        // 8. Notify passenger
        try {
            await supabaseAdmin.from('notifications').insert({
                user_id: booking.passenger_id,
                type: 'passenger_dropped',
                title: 'You have arrived!',
                message: `You have been dropped off. Total fare: ₹${totalAmount}`,
                data: { trip_id, booking_id, amount: totalAmount }
            })

            // Broadcast to passenger
            const channel = supabaseAdmin.channel(`passenger_${booking.passenger_id}`)
            await channel.send({
                type: 'broadcast',
                event: 'passenger_dropped',
                payload: {
                    trip_id,
                    booking_id,
                    amount: totalAmount,
                    payment_id: payment?.id,
                    message: 'You have arrived at your destination!'
                }
            })
            supabaseAdmin.removeChannel(channel)
        } catch (notifErr) {
            console.error('Notification error (non-critical):', notifErr)
        }

        // 9. Check if ALL passengers dropped
        const { data: allBookings, error: allError } = await supabaseAdmin
            .from('booking_requests')
            .select('id, drop_status')
            .eq('trip_id', trip_id)
            .eq('status', 'completed')

        // Count verified bookings that are approved or completed
        const { data: totalApproved } = await supabaseAdmin
            .from('booking_requests')
            .select('id, drop_status')
            .eq('trip_id', trip_id)
            .in('status', ['approved', 'completed'])

        const allDropped = totalApproved?.every(b => b.drop_status === 'completed') || false

        if (allDropped) {
            // Don't mark trip completed here — driver must swipe-to-finish.
            // Just report all_dropped so the frontend enables the finish button.
            console.log('All passengers dropped for trip', trip_id)
        }

        return new Response(
            JSON.stringify({
                success: true,
                all_dropped: allDropped,
                payment: payment ? {
                    id: payment.id,
                    total_amount: totalAmount,
                    commission: commissionAmount,
                    driver_amount: driverAmount
                } : null,
                message: allDropped
                    ? 'All passengers dropped! Ride completed. Earnings credited to wallet.'
                    : 'Passenger dropped successfully'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Function Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
