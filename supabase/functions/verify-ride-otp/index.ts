import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_OTP_ATTEMPTS = 5

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

        const { trip_id, booking_id, otp } = await req.json()
        if (!trip_id || !booking_id || !otp) {
            throw new Error('Missing required fields: trip_id, booking_id, otp')
        }

        // 3. Verify trip and driver ownership
        const { data: trip, error: tripError } = await supabaseAdmin
            .from('trips')
            .select('id, user_id, status')
            .eq('id', trip_id)
            .single()

        if (tripError || !trip) throw new Error('Trip not found')
        if (trip.user_id !== user.id) throw new Error('Not authorized')

        // 4. Get the booking
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from('booking_requests')
            .select('id, passenger_id, otp_code, otp_verified, otp_attempts')
            .eq('id', booking_id)
            .eq('trip_id', trip_id)
            .single()

        if (bookingError || !booking) throw new Error('Booking not found')

        // Already verified
        if (booking.otp_verified) {
            return new Response(
                JSON.stringify({ success: true, already_verified: true, message: 'Already verified' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Check attempt limit
        if (booking.otp_attempts >= MAX_OTP_ATTEMPTS) {
            return new Response(
                JSON.stringify({
                    success: false,
                    locked: true,
                    message: `Too many attempts (${MAX_OTP_ATTEMPTS}). OTP verification locked.`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 5. Verify OTP
        if (booking.otp_code !== otp) {
            // Increment attempts
            await supabaseAdmin
                .from('booking_requests')
                .update({ otp_attempts: (booking.otp_attempts || 0) + 1 })
                .eq('id', booking_id)

            const remaining = MAX_OTP_ATTEMPTS - (booking.otp_attempts || 0) - 1
            return new Response(
                JSON.stringify({
                    success: false,
                    message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
                    attempts_remaining: remaining
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 6. OTP correct — mark verified
        const { error: verifyError } = await supabaseAdmin
            .from('booking_requests')
            .update({ otp_verified: true })
            .eq('id', booking_id)

        if (verifyError) throw verifyError

        // 8. Simplified response for dynamic partial verification
        return new Response(
            JSON.stringify({
                success: true,
                verified: true,
                message: 'Passenger verified successfully'
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
