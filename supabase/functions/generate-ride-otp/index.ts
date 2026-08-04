import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { sendEmail, rideOtpEmail } from "../_shared/emailHelper.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Start Messaging Ride OTP helper ─────────────────────────────────────────
const START_MESSAGING_BASE_URL = 'https://api.startmessaging.com'
const DEFAULT_TEMPLATE_ID = '0afbdeb0-785d-4dd0-bd48-365a182df276'

function normaliseE164Phone(phone: string): string {
    if (!phone) return ''
    let cleaned = phone.trim().replace(/[^\d+]/g, '')
    if (!cleaned.startsWith('+')) {
        const digits = cleaned.replace(/\D/g, '')
        if (digits.length === 10) {
            cleaned = `+91${digits}`
        } else {
            cleaned = `+${digits}`
        }
    }
    return cleaned
}

async function sendRideOtpStartMessaging(phone: string, otp: string): Promise<boolean> {
    const apiKey = Deno.env.get('START_MESSAGING_API_KEY') ||
        Deno.env.get('STARTMESSAGING_API_KEY') ||
        Deno.env.get('START_MESSAGING_KEY') ||
        ''
    const templateId = Deno.env.get('START_MESSAGING_TEMPLATE_ID') || DEFAULT_TEMPLATE_ID
    const appName = Deno.env.get('APP_NAME') || 'XPool'

    if (!apiKey) {
        console.error('[StartMessaging] Missing START_MESSAGING_API_KEY environment variable in Supabase Secrets')
        return false
    }

    const phoneNumber = normaliseE164Phone(phone)
    try {
        console.log(`[generate-ride-otp] Dispatching Ride OTP ${otp} to ${phoneNumber} via Start Messaging`)
        const res = await fetch(`${START_MESSAGING_BASE_URL}/otp/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                phoneNumber,
                templateId,
                variables: { otp, appName }
            })
        })
        const data = await res.json().catch(() => ({}))
        return res.ok && (data.success || data.status === 'success' || data.message || res.status === 200)
    } catch (err) {
        console.error('[generate-ride-otp] Ride OTP send error:', err)
        return false
    }
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
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

        // 4. Get all approved bookings for this trip
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

            // Skip if already has OTP and not a forced resend
            if (booking.otp_code && !booking.otp_verified && !force_resend) {
                console.log(`Booking ${booking.id} already has OTP, skipping generation`)
                results.push({ booking_id: booking.id, passenger_id: booking.passenger_id, pickup_order: i + 1, otp_sent: false, reason: 'already_has_otp' })
                continue
            }

            // Skip already verified passengers
            if (booking.otp_verified) {
                console.log(`Booking ${booking.id} already verified, skipping`)
                results.push({ booking_id: booking.id, passenger_id: booking.passenger_id, pickup_order: i + 1, otp_sent: false, reason: 'already_verified' })
                continue
            }

            // Generate 4-digit ride OTP
            const otp = Math.floor(1000 + Math.random() * 9000).toString()

            // Update booking with OTP
            const { error: updateError } = await supabaseAdmin
                .from('booking_requests')
                .update({ otp_code: otp, otp_verified: false, otp_attempts: 0, pickup_order: i + 1 })
                .eq('id', booking.id)

            if (updateError) {
                console.error(`Error updating booking ${booking.id}:`, updateError)
                continue
            }

            // ── Fetch passenger profile (name + phone) ─────────────────────
            let passengerName = 'Passenger'
            let passengerPhone = ''
            let passengerEmail = ''

            try {
                const { data: passengerAuth } = await supabaseAdmin.auth.admin.getUserById(booking.passenger_id)
                passengerEmail = passengerAuth?.user?.email || ''

                const { data: passengerProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name, phone')
                    .eq('id', booking.passenger_id)
                    .single()

                if (passengerProfile?.full_name) passengerName = passengerProfile.full_name
                if (passengerProfile?.phone) passengerPhone = passengerProfile.phone
            } catch (profileErr) {
                console.error('Profile fetch error (non-critical):', profileErr)
            }

            // ── In-app notification ────────────────────────────────────────
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

            // ── Real-time broadcast ────────────────────────────────────────
            try {
                const channel = supabaseAdmin.channel(`passenger_${booking.passenger_id}`)
                await channel.send({
                    type: 'broadcast',
                    event: 'ride_otp',
                    payload: { trip_id, booking_id: booking.id, otp, pickup_order: i + 1, message: `Your OTP is: ${otp}` }
                })
                supabaseAdmin.removeChannel(channel)
            } catch (broadcastErr) {
                console.error('Broadcast error (non-critical):', broadcastErr)
            }

            // ── Start Messaging SMS (primary channel) ─────────────────────────
            if (passengerPhone) {
                try {
                    const sent = await sendRideOtpStartMessaging(passengerPhone, otp)
                    console.log(`[generate-ride-otp] Start Messaging OTP ${sent ? 'sent' : 'FAILED'} to ${passengerPhone}`)
                } catch (smErr) {
                    console.error('Start Messaging OTP send error (non-critical):', smErr)
                }
            } else {
                console.warn(`[generate-ride-otp] No phone number for passenger ${booking.passenger_id}, skipping SMS dispatch`)
            }

            // ── Email fallback ─────────────────────────────────────────────
            if (passengerEmail) {
                try {
                    await sendEmail({
                        to: passengerEmail,
                        subject: `🔐 Your Ride OTP — ${trip.from_location} → ${trip.to_location}`,
                        html: rideOtpEmail({ passengerName, otp, from: trip.from_location, to: trip.to_location, date: travelDate }),
                    })
                } catch (emailErr) {
                    console.error('Email OTP send error (non-critical):', emailErr)
                }
            }

            results.push({ booking_id: booking.id, passenger_id: booking.passenger_id, pickup_order: i + 1, otp_sent: true })
        }

        const generated = results.filter(r => r.otp_sent).length
        return new Response(
            JSON.stringify({
                success: true,
                message: generated > 0 ? `OTP generated for ${generated} passenger(s)` : 'All passengers already have OTPs',
                data: results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Function Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as any).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
