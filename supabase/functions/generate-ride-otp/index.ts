import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { sendEmail, rideOtpEmail } from "../_shared/emailHelper.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

        const { trip_id, force_resend } = await req.json()
        if (!trip_id) throw new Error('Missing trip_id')

        // 3. Verify trip exists and driver owns it
        const { data: trip, error: tripError } = await supabaseAdmin
            .from('trips')
            .select('id, user_id, status, from_location, to_location, travel_date')
            .eq('id', trip_id)
            .single()

        if (tripError || !trip) throw new Error('Trip not found')
        if (trip.user_id !== user.id) throw new Error('Not authorized — you do not own this trip')
        if (trip.status === 'in_progress') throw new Error('Ride already started')

        // 4. Get all approved bookings for this trip (include otp_code to check if already generated)
        const { data: bookings, error: bookingsError } = await supabaseAdmin
            .from('booking_requests')
            .select('id, passenger_id, seats_requested, otp_code, otp_verified')
            .eq('trip_id', trip_id)
            .eq('status', 'approved')

        if (bookingsError) throw bookingsError
        if (!bookings || bookings.length === 0) {
            throw new Error('No approved passengers for this trip')
        }

        const travelDate = trip.travel_date
            ? new Date(trip.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A'

        // 5. Generate OTP for each passenger
        const results = []
        for (let i = 0; i < bookings.length; i++) {
            const booking = bookings[i]

            // ✅ FIX: Skip if this passenger already has an OTP and it's not a forced resend
            // This prevents overwriting an existing OTP that the passenger already received
            if (booking.otp_code && !booking.otp_verified && !force_resend) {
                console.log(`Booking ${booking.id} already has OTP, skipping generation`)
                results.push({
                    booking_id: booking.id,
                    passenger_id: booking.passenger_id,
                    pickup_order: i + 1,
                    otp_sent: false,
                    reason: 'already_has_otp'
                })
                continue
            }

            // Skip already verified passengers
            if (booking.otp_verified) {
                console.log(`Booking ${booking.id} already verified, skipping`)
                results.push({
                    booking_id: booking.id,
                    passenger_id: booking.passenger_id,
                    pickup_order: i + 1,
                    otp_sent: false,
                    reason: 'already_verified'
                })
                continue
            }

            const otp = Math.floor(1000 + Math.random() * 9000).toString()

            // Update booking with OTP
            const { error: updateError } = await supabaseAdmin
                .from('booking_requests')
                .update({
                    otp_code: otp,
                    otp_verified: false,
                    otp_attempts: 0,
                    pickup_order: i + 1
                })
                .eq('id', booking.id)

            if (updateError) {
                console.error(`Error updating booking ${booking.id}:`, updateError)
                continue
            }

            // Send in-app notification
            try {
                await supabaseAdmin.from('notifications').insert({
                    user_id: booking.passenger_id,
                    type: 'ride_otp',
                    title: '🔐 Your Ride OTP',
                    message: `Your OTP for today's ride is: ${otp}. Share it with your driver to start the ride.`,
                    data: { trip_id, booking_id: booking.id, otp }
                })
            } catch (notifErr) {
                console.error('Notification error (non-critical):', notifErr)
            }

            // Send real-time broadcast to passenger
            try {
                const channel = supabaseAdmin.channel(`passenger_${booking.passenger_id}`)
                await channel.send({
                    type: 'broadcast',
                    event: 'ride_otp',
                    payload: {
                        trip_id,
                        booking_id: booking.id,
                        otp,
                        pickup_order: i + 1,
                        message: `Your OTP is: ${otp}`
                    }
                })
                supabaseAdmin.removeChannel(channel)
            } catch (broadcastErr) {
                console.error('Broadcast error (non-critical):', broadcastErr)
            }

            // Send OTP via Email
            try {
                const { data: passengerAuth } = await supabaseAdmin.auth.admin.getUserById(booking.passenger_id)
                const passengerEmail = passengerAuth?.user?.email || ''

                let passengerName = 'Passenger'
                const { data: passengerProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', booking.passenger_id)
                    .single()
                if (passengerProfile?.full_name) passengerName = passengerProfile.full_name

                if (passengerEmail) {
                    await sendEmail({
                        to: passengerEmail,
                        subject: `🔐 Your Ride OTP — ${trip.from_location} → ${trip.to_location}`,
                        html: rideOtpEmail({
                            passengerName,
                            otp,
                            from: trip.from_location,
                            to: trip.to_location,
                            date: travelDate,
                        }),
                    })
                }
            } catch (emailErr) {
                console.error('Email OTP send error (non-critical):', emailErr)
            }

            results.push({
                booking_id: booking.id,
                passenger_id: booking.passenger_id,
                pickup_order: i + 1,
                otp_sent: true
            })
        }

        const generated = results.filter(r => r.otp_sent).length
        return new Response(
            JSON.stringify({
                success: true,
                message: generated > 0
                    ? `OTP generated for ${generated} passenger(s)`
                    : 'All passengers already have OTPs',
                data: results
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
