// index.ts (Single file version)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// CORS headers directly in the file
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Search Trips Edge Function loaded")

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Only accept POST requests
        if (req.method !== 'POST') {
            throw new Error('Method not allowed')
        }

        // Parse request body
        const {
            fromLocation,
            toLocation,
            travelDate,
            vehiclePreference = 'any',
            page = 1,
            pageSize = 20
        } = await req.json()

        // Validate required fields
        if (!fromLocation?.trim() || !toLocation?.trim()) {
            throw new Error('From and To locations are required')
        }

        // Create Supabase client with service role key
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    persistSession: false,
                }
            }
        )

        // Call the database function
        const { data, error } = await supabaseClient
            .rpc('search_trips', {
                search_from: fromLocation.trim(),
                search_to: toLocation.trim(),
                search_date: travelDate || null,
                vehicle_pref: vehiclePreference,
                page_number: page,
                page_size: pageSize
            })

        if (error) {
            console.error('RPC Error:', error)
            throw error
        }

        // Format the response
        const trips = data || []
        const totalCount = trips.length > 0 ? parseInt(trips[0].total_count) : 0
        const hasMore = (page * pageSize) < totalCount

        // Return successful response
        return new Response(
            JSON.stringify({
                success: true,
                data: trips.map(trip => ({
                    ...trip,
                    formatted_date: formatDate(trip.travel_date),
                    formatted_time: formatTime(trip.travel_time)
                })),
                pagination: {
                    currentPage: page,
                    pageSize,
                    totalCount,
                    hasMore,
                    totalPages: Math.ceil(totalCount / pageSize)
                }
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
                },
                status: 200,
            }
        )

    } catch (error) {
        console.error('Function Error:', error.message)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                },
                status: error.message === 'Method not allowed' ? 405 : 400,
            }
        )
    }
})

// Helper functions for formatting
function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    })
}

function formatTime(timeStr: string): string {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
}
