import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { sendEmail, newBookingRequestEmail, bookingRequestSentEmail } from "../_shared/emailHelper.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Create User Client to Verify Identity
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            console.error("Auth error:", authError)
            throw new Error('Unauthorized')
        }

        // 2. Create Admin Client for DB Operations (Bypass RLS)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse request body
        let body
        try {
            body = await req.json()
        } catch (e) {
            console.error("JSON parse error:", e)
            throw new Error('Invalid request body - could not parse JSON')
        }

        console.log("Request body:", JSON.stringify(body))

        const { trip_id, passenger_id, seats_requested, payment_mode, message, passenger_location, passenger_destination } = body

        if (!trip_id || !passenger_id || !seats_requested) {
            console.error("Missing fields - trip_id:", trip_id, "passenger_id:", passenger_id, "seats_requested:", seats_requested)
            throw new Error('Missing required fields: trip_id, passenger_id, and seats_requested are required')
        }

        // Security Check: Ensure the caller is the passenger they claim to be
        if (passenger_id !== user.id) {
            throw new Error('Passenger ID mismatch')
        }

        // 3. Get Trip Details
        const { data: trip, error: tripError } = await supabaseAdmin
            .from('trips')
            .select('user_id, available_seats, status, from_location, to_location, travel_date, travel_time')
            .eq('id', trip_id)
            .single()

        if (tripError || !trip) {
            throw new Error('Trip not found')
        }

        if (trip.status !== 'active') {
            throw new Error(`Trip is ${trip.status}`)
        }

        if (trip.available_seats < seats_requested) {
            throw new Error(`Not enough seats available. Only ${trip.available_seats} left.`)
        }

        // 4. Check for existing booking
        const { data: existingBooking } = await supabaseAdmin
            .from('booking_requests')
            .select('id, status')
            .eq('trip_id', trip_id)
            .eq('passenger_id', passenger_id)
            .in('status', ['pending', 'approved'])
            .maybeSingle()

        if (existingBooking) {
            throw new Error(`You already have a ${existingBooking.status} booking for this trip`)
        }

        // 5. Create Booking Request
        const { data: newBooking, error: insertError } = await supabaseAdmin
            .from('booking_requests')
            .insert([
                {
                    trip_id,
                    passenger_id,
                    driver_id: trip.user_id,
                    seats_requested,
                    payment_mode,
                    message,
                    passenger_location: passenger_location || null,
                    passenger_destination: passenger_destination || null,
                    status: 'pending'
                }
            ])
            .select()
            .single()

        if (insertError) {
            console.error("Insert Error", insertError)
            throw insertError
        }

        // 6. Fetch passenger name and driver info for notifications
        const passengerName = user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0] || 'A Passenger'
        const passengerEmail = user.email || ''
        const travelDate = trip.travel_date ? new Date(trip.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'
        const travelTime = trip.travel_time ? trip.travel_time.substring(0, 5) : 'N/A'

        // Fetch driver profile and email (non-critical)
        let driverName = 'Your Driver'
        let driverEmail = ''
        try {
            const { data: driverProfile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', trip.user_id)
                .single()
            if (driverProfile?.full_name) driverName = driverProfile.full_name

            // Fetch driver's email from auth (service role only)
            const { data: driverAuth } = await supabaseAdmin.auth.admin.getUserById(trip.user_id)
            if (driverAuth?.user?.email) driverEmail = driverAuth.user.email
        } catch (profileErr) {
            console.error("Profile fetch error (non-critical):", profileErr)
        }

        // 7. Send Email to Driver: New Booking Request
        if (driverEmail) {
            await sendEmail({
                to: driverEmail,
                subject: `New Booking Request — ${trip.from_location} to ${trip.to_location}`,
                html: newBookingRequestEmail({
                    driverName,
                    passengerName,
                    from: trip.from_location,
                    to: trip.to_location,
                    date: travelDate,
                    time: travelTime,
                    seats: seats_requested,
                }),
            })
        }

        // 8. Send Email to Passenger: Request Confirmation
        if (passengerEmail) {
            await sendEmail({
                to: passengerEmail,
                subject: `Booking Requested — ${trip.from_location} → ${trip.to_location}`,
                html: bookingRequestSentEmail({
                    passengerName,
                    from: trip.from_location,
                    to: trip.to_location,
                    date: travelDate,
                    time: travelTime,
                }),
            })
        }

        // 9. Send Notification to Driver (DB Notification)
        if (trip.user_id) {
            try {
                await supabaseAdmin.from('notifications').insert({
                    user_id: trip.user_id,
                    type: 'booking_pending',
                    title: 'New Booking Request',
                    message: `New request from ${passengerName} for your trip to ${trip.to_location}`,
                    data: { trip_id: trip_id, booking_id: newBooking.id }
                })
            } catch (notifErr) {
                console.error("Notification error (non-critical):", notifErr)
            }

            // 10. BROADCAST to Driver (Real-time)
            const channel = supabaseAdmin.channel(`driver_${trip.user_id}_trips`)
            await channel.send({
                type: 'broadcast',
                event: 'new_booking',
                payload: {
                    trip_id: trip_id,
                    booking_id: newBooking.id,
                    passenger_id: passenger_id,
                    passenger_name: passengerName,
                    seats_requested: seats_requested,
                    from: trip.from_location,
                    to: trip.to_location
                }
            })
            supabaseAdmin.removeChannel(channel)
        }

        return new Response(
            JSON.stringify({ success: true, data: newBooking }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error("Function Error:", error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
