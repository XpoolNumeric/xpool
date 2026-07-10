import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, rideStartedEmail } from '../_shared/emailHelper.ts'

interface ValidateTripStartRequest {
    tripId: string
    driverId: string
    action: 'check' | 'start'
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    try {
        const { tripId, driverId, action } = await req.json() as ValidateTripStartRequest

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const authHeader = req.headers.get('Authorization')!
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        )

        const corsHeaders = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }

        // 1. Verify the driver owns this trip
        const { data: trip, error: tripError } = await supabaseClient
            .from('trips')
            .select(`
                *,
                booking_requests (
                id,
                status,
                otp_verified,
                passenger_id
                )
            `)
            .eq('id', tripId)
            .eq('user_id', driverId)
            .single()

        if (tripError || !trip) {
            console.error('[validate-trip-start] Error fetching trip:', tripError);
            return new Response(
                JSON.stringify({
                    success: false,
                    canStart: false,
                    error: tripError?.message || 'Trip not found or unauthorized',
                    code: 'TRIP_NOT_FOUND'
                }),
                { status: 404, headers: corsHeaders }
            )
        }

        // 2. Validate trip status
        if (trip.status !== 'active' && trip.status !== 'full') {
            return new Response(
                JSON.stringify({
                    success: false,
                    canStart: false,
                    error: `Trip is ${trip.status.replace('_', ' ')}, cannot start.`,
                    code: 'INVALID_STATUS',
                    currentStatus: trip.status
                }),
                { status: 200, headers: corsHeaders }
            )
        }

        // 3. Date validation - Check if trip is today
        const tripDate = new Date(trip.travel_date)
        const today = new Date()

        const isToday = tripDate.getDate() === today.getDate() &&
            tripDate.getMonth() === today.getMonth() &&
            tripDate.getFullYear() === today.getFullYear()

        if (!isToday) {
            const daysUntil = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const message = daysUntil > 0
                ? `Trip starts in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`
                : `Trip was ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''} ago`

            return new Response(
                JSON.stringify({
                    success: false,
                    canStart: false,
                    error: message,
                    code: 'NOT_TODAY',
                    daysUntil
                }),
                { status: 200, headers: corsHeaders }
            )
        }

        // 4. Get verified and pending passengers
        const verifiedPassengers = trip.booking_requests?.filter(
            (b: any) => b.status === 'approved' && b.otp_verified
        ) || []

        const pendingPassengers = trip.booking_requests?.filter(
            (b: any) => b.status === 'approved' && !b.otp_verified
        ) || []

        // 5. Get driver's recent stats
        const { data: recentTrips } = await supabaseAdmin
            .from('trips')
            .select('id, status, created_at')
            .eq('user_id', driverId)
            .eq('status', 'completed')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        // 6. If action is 'start', update trip status and notify all passengers
        if (action === 'start') {
            const { error: updateError } = await supabaseClient
                .from('trips')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', tripId)

            if (updateError) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        canStart: false,
                        error: 'Failed to start trip',
                        code: 'UPDATE_FAILED'
                    }),
                    { status: 500, headers: corsHeaders }
                )
            }

            // Fetch driver info for email
            let driverName = 'Your Driver'
            let driverPhone = ''
            try {
                const { data: driverProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name, phone_number')
                    .eq('id', driverId)
                    .single()
                if (driverProfile?.full_name) driverName = driverProfile.full_name
                if (driverProfile?.phone_number) driverPhone = driverProfile.phone_number
            } catch (e) {
                console.error('[validate-trip-start] Driver profile fetch error (non-critical):', e)
            }

            // Get all approved passengers for this trip and notify them
            const approvedBookings = trip.booking_requests?.filter((b: any) => b.status === 'approved') || []

            const sendAllNotifications = async () => {
                const notificationPromises = approvedBookings.map(async (booking: any) => {
                    const passengerId = booking.passenger_id

                    try {
                        // 1. Insert DB notification
                        await supabaseAdmin.from('notifications').insert({
                            user_id: passengerId,
                            type: 'ride_started',
                            title: '🚗 Your Ride Has Started!',
                            message: `${driverName} has started the journey. Track live in the app.`,
                            data: { trip_id: tripId, booking_id: booking.id }
                        }).catch(e => console.error('[validate-trip-start] Notification err:', e));

                        // 2. Real-time broadcast
                        const channel = supabaseAdmin.channel(`passenger_${passengerId}`)
                        await channel.send({
                            type: 'broadcast',
                            event: 'ride_started',
                            payload: {
                                trip_id: tripId,
                                booking_id: booking.id,
                                driver_name: driverName,
                                driver_phone: driverPhone,
                                from: trip.from_location,
                                to: trip.to_location,
                            }
                        }).catch(e => console.error('[validate-trip-start] Broadcast err:', e))
                        supabaseAdmin.removeChannel(channel)

                        // 3. Send email to passenger concurrently
                        // Fetching profile and auth concurrently
                        const [authRes, profileRes] = await Promise.all([
                            supabaseAdmin.auth.admin.getUserById(passengerId).catch(() => ({ data: null })),
                            supabaseAdmin.from('profiles').select('full_name').eq('id', passengerId).single().catch(() => ({ data: null }))
                        ]);
                        
                        const passengerEmail = authRes.data?.user?.email;
                        const passengerName = profileRes.data?.full_name || 'Passenger';

                        if (passengerEmail) {
                            await sendEmail({
                                to: passengerEmail,
                                subject: `🚗 Your Ride Has Started — ${trip.from_location} → ${trip.to_location}`,
                                html: rideStartedEmail({
                                    passengerName,
                                    driverName,
                                    driverPhone,
                                    from: trip.from_location,
                                    to: trip.to_location,
                                }),
                            }).catch(e => console.error('[validate-trip-start] Email err:', e))
                        }
                    } catch (err) {
                        console.error(`[validate-trip-start] Core sync error for pax ${passengerId}:`, err);
                    }
                });

                await Promise.allSettled(notificationPromises);
            };

            // Await all background notifications to prevent V8 Isolate from prematurely terminating them under high load
            await sendAllNotifications();
        }

        // 7. Prepare passenger details for UI
        const passengerDetails = [
            ...verifiedPassengers.map((p: any) => ({
                id: p.passenger_id,
                name: p.passengers?.full_name || 'Passenger',
                verified: true,
                verifiedAt: p.verified_at
            })),
            ...pendingPassengers.map((p: any) => ({
                id: p.passenger_id,
                name: p.passengers?.full_name || 'Passenger',
                verified: false,
                verifiedAt: null
            }))
        ]

        // 8. Return success response
        return new Response(
            JSON.stringify({
                success: true,
                canStart: true,
                action: action || 'check',
                data: {
                    trip: {
                        id: trip.id,
                        from_location: trip.from_location,
                        to_location: trip.to_location,
                        travel_date: trip.travel_date,
                        travel_time: trip.travel_time,
                        vehicle_type: trip.vehicle_type,
                        available_seats: trip.available_seats,
                        price_per_seat: trip.price_per_seat
                    },
                    passengers: {
                        total: trip.booking_requests?.length || 0,
                        verified: verifiedPassengers.length,
                        pending: pendingPassengers.length,
                        details: passengerDetails
                    },
                    insights: {
                        isToday,
                        driverStats: {
                            completedTripsLast30Days: recentTrips?.length || 0,
                            reliabilityScore: calculateReliabilityScore(recentTrips?.length || 0)
                        },
                        estimatedEarnings: verifiedPassengers.length * (trip.price_per_seat || 0)
                    },
                    suggestions: generateSuggestions(verifiedPassengers.length, pendingPassengers.length)
                }
            }),
            { status: 200, headers: corsHeaders }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({
                success: false,
                canStart: false,
                error: error.message,
                code: 'INTERNAL_ERROR'
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        )
    }
})

function calculateReliabilityScore(completedTrips: number): number {
    if (completedTrips === 0) return 100
    if (completedTrips < 5) return 95
    if (completedTrips < 10) return 98
    return 100
}

function generateSuggestions(verified: number, pending: number): string[] {
    const suggestions = []

    if (verified === 0 && pending === 0) {
        suggestions.push('No passengers booked yet. Keep this trip active to receive bookings.')
    }

    if (pending > 0) {
        suggestions.push(`${pending} passenger${pending > 1 ? 's are' : ' is'} waiting for OTP verification.`)
    }

    if (verified > 0) {
        suggestions.push(`${verified} verified passenger${verified > 1 ? 's' : ''} ready to go!`)
    }

    return suggestions
}
