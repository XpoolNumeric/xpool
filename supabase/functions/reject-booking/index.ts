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

        if (booking.status === 'rejected') {
            throw new Error('Booking is already rejected')
        }

        // 4. Verify Driver Ownership
        if (booking.trips.user_id !== user.id) {
            throw new Error('You are not authorized to reject this booking')
        }

        // 5. Update Booking Status
        const { error: bookingUpdateError } = await supabaseAdmin
            .from('booking_requests')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', booking_id)

        if (bookingUpdateError) {
            throw new Error('Failed to update booking status')
        }

        // 6. Notification to Passenger (DB)
        await supabaseAdmin.from('notifications').insert({
            user_id: booking.passenger_id,
            type: 'booking_rejected',
            title: 'Booking Declined',
            message: `Your request for the ride to ${booking.trips.to_location} has been declined. You can search for other available rides.`,
            data: { trip_id: booking.trip_id, booking_id: booking.id }
        }).catch(err => console.error("Notification error", err))

        // 7. BROADCAST to Passenger (Real-time)
        const channel = supabaseAdmin.channel(`passenger_${booking.passenger_id}`)

        await channel.send({
            type: 'broadcast',
            event: 'booking_rejected',
            payload: {
                booking_id: booking.id,
                trip_id: booking.trip_id,
                trip: {
                    from: booking.trips.from_location,
                    to: booking.trips.to_location
                }
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
