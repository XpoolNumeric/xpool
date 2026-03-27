import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { sendEmail, bookingApprovedEmail } from "../_shared/emailHelper.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Create User Client for Auth
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
            throw new Error('Unauthorized')
        }

        // 2. Create Admin Client for DB Ops
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { booking_id } = await req.json()

        if (!booking_id) {
            throw new Error('Missing booking_id')
        }

        // 3. Fetch Booking and Trip
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from('booking_requests')
            .select('*, trips(*)')
            .eq('id', booking_id)
            .single()

        if (bookingError || !booking) {
            throw new Error('Booking not found')
        }

        if (booking.status === 'approved') {
            throw new Error('Booking is already approved')
        }

        // 4. Verify Driver Ownership
        if (booking.trips.user_id !== user.id) {
            throw new Error('You are not authorized to approve this booking')
        }

        // 5. Check Seat Availability
        if (booking.trips.available_seats < booking.seats_requested) {
            throw new Error('Not enough seats available to approve this request')
        }

        // 6. Update Trip Seats
        const newSeats = booking.trips.available_seats - booking.seats_requested
        const newStatus = newSeats <= 0 ? 'full' : 'active'

        const { error: tripUpdateError } = await supabaseAdmin
            .from('trips')
            .update({ available_seats: newSeats, status: newStatus })
            .eq('id', booking.trip_id)

        if (tripUpdateError) {
            throw new Error('Failed to update trip seats')
        }

        // 7. Update Booking Status
        const { error: bookingUpdateError } = await supabaseAdmin
            .from('booking_requests')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', booking_id)

        if (bookingUpdateError) {
            throw new Error('Failed to update booking status')
        }

        // 8. Fetch Driver Profile and email for the confirmation email
        let driverInfo = {
            name: user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0] || 'Driver',
            phone: user.phone || user.user_metadata?.phone || '',
            vehicle_type: booking.trips.vehicle_type || 'car',
            vehicle_number: ''
        }

        try {
            const { data: driverProfile } = await supabaseAdmin
                .from('profiles')
                .select('full_name, phone_number')
                .eq('id', user.id)
                .single()

            if (driverProfile) {
                driverInfo.name = driverProfile.full_name || driverInfo.name
                driverInfo.phone = driverProfile.phone_number || driverInfo.phone
            }

            const { data: driverRecord } = await supabaseAdmin
                .from('drivers')
                .select('vehicle_number')
                .eq('user_id', user.id)
                .maybeSingle()

            if (driverRecord) {
                driverInfo.vehicle_number = driverRecord.vehicle_number || ''
            }
        } catch (profileErr) {
            console.error("Profile fetch error (non-critical):", profileErr)
        }

        // 9. Notify Passenger via DB notification
        const travelDate = booking.trips.travel_date
            ? new Date(booking.trips.travel_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A'
        const travelTime = booking.trips.travel_time ? booking.trips.travel_time.substring(0, 5) : 'N/A'
        const totalPrice = (booking.trips.price_per_seat * booking.seats_requested).toString()

        const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
            user_id: booking.passenger_id,
            type: 'booking_approved',
            title: '🎉 Booking Confirmed!',
            message: `Your request for the ride to ${booking.trips.to_location} has been approved by ${driverInfo.name}.`,
            data: { trip_id: booking.trip_id, booking_id: booking.id }
        });

        if (notificationError) {
            console.error("Notification error (non-critical):", notificationError);
        }

        // 10. Send Confirmation Email to Passenger
        try {
            const { data: passengerAuth } = await supabaseAdmin.auth.admin.getUserById(booking.passenger_id)
            const passengerEmail = passengerAuth?.user?.email || ''

            // Get passenger name from profiles
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
                    subject: `Ride Confirmed! 🎉 — ${booking.trips.from_location} → ${booking.trips.to_location}`,
                    html: bookingApprovedEmail({
                        passengerName,
                        driverName: driverInfo.name,
                        driverPhone: driverInfo.phone,
                        vehicleType: driverInfo.vehicle_type,
                        vehicleNumber: driverInfo.vehicle_number,
                        from: booking.trips.from_location,
                        to: booking.trips.to_location,
                        date: travelDate,
                        time: travelTime,
                        totalPrice,
                    }),
                })
            }
        } catch (emailErr) {
            console.error("Email send error (non-critical):", emailErr)
        }

        // 11. BROADCAST to Passenger (Real-time)
        const channel = supabaseAdmin.channel(`passenger_${booking.passenger_id}`)
        await channel.send({
            type: 'broadcast',
            event: 'booking_approved',
            payload: {
                booking_id: booking.id,
                trip_id: booking.trip_id,
                trip: {
                    from: booking.trips.from_location,
                    to: booking.trips.to_location
                },
                driver_info: driverInfo
            }
        })
        supabaseAdmin.removeChannel(channel)

        return new Response(
            JSON.stringify({ success: true }),
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
