// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.info('🚗 Find Rides Edge Function started');

Deno.serve(async (req: Request) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get authorization token
        const authHeader = req.headers.get('Authorization');
        const apiKey = req.headers.get('apikey');

        if (!authHeader && !apiKey) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header or API key' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Parse request body
        let request;
        try {
            request = await req.json();
        } catch (e) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Invalid JSON in request body'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('🔍 Search request received:', JSON.stringify(request));

        // Validate required fields
        if (!request.from_location || !request.to_location) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'from_location and to_location are required'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get Supabase URL and key from environment
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Missing Supabase environment variables');
            throw new Error('Missing Supabase environment variables');
        }

        console.log('✅ Supabase client configured');

        // Create Supabase client
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Set default values
        const seats_required = request.seats_required || 1;
        const page = request.page || 1;
        const limit = Math.min(request.limit || 20, 50);
        const offset = (page - 1) * limit;

        console.log('📋 Search parameters:', {
            from: request.from_location,
            to: request.to_location,
            date: request.travel_date || 'any',
            seats: seats_required,
            vehicle: request.vehicle_type || 'any',
            page,
            limit
        });

        // Build the base query
        let query = supabase
            .from('trips')
            .select('*', { count: 'exact' })
            .eq('status', 'active')
            .gte('available_seats', seats_required)
            .gte('travel_date', new Date().toISOString().split('T')[0]) // Only future trips
            .order('travel_date', { ascending: true })
            .order('travel_time', { ascending: true })
            .range(offset, offset + limit - 1);

        // Apply location filters
        if (request.from_location) {
            const searchTerm = request.from_location.toLowerCase().trim();
            query = query.ilike('from_location', `%${searchTerm}%`);
        }

        if (request.to_location) {
            const searchTerm = request.to_location.toLowerCase().trim();
            query = query.ilike('to_location', `%${searchTerm}%`);
        }

        // Apply date filter if provided
        if (request.travel_date) {
            query = query.eq('travel_date', request.travel_date);
        }

        // Apply vehicle type filter
        if (request.vehicle_type && request.vehicle_type !== 'any') {
            query = query.eq('vehicle_type', request.vehicle_type);
        }

        console.log('📊 Executing database query...');

        // Execute query
        const { data: trips, error, count } = await query;

        if (error) {
            console.error('❌ Database query error:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`✅ Found ${trips?.length || 0} trips (Total in DB: ${count || 0})`);

        // If no trips found, return empty array
        if (!trips || trips.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    data: [],
                    meta: {
                        total: 0,
                        page,
                        limit,
                        total_pages: 0,
                        has_more: false
                    },
                    message: 'No trips found matching your criteria'
                }),
                {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        // Try to fetch driver profiles for better user experience
        const userIds = [...new Set(trips.map(trip => trip.user_id).filter(Boolean))];
        let profiles = {};

        if (userIds.length > 0) {
            try {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);

                if (!profilesError && profilesData) {
                    profilesData.forEach(profile => {
                        profiles[profile.id] = profile;
                    });
                    console.log(`✅ Fetched ${profilesData.length} driver profiles`);
                }
            } catch (profileError) {
                console.warn('⚠️ Could not fetch profiles, using default driver names:', profileError.message);
            }
        }

        // Format results
        const formattedTrips = trips.map(trip => {
            const driverInfo = profiles[trip.user_id] || {};
            const driverName = driverInfo.full_name || `Driver ${trip.user_id?.substring(0, 4) || '001'}`;
            const formattedTime = formatTime(trip.travel_time);
            const matchScore = calculateMatchScore(trip, request);

            return {
                id: trip.id,
                driver: {
                    id: trip.user_id,
                    name: driverName,
                    avatar: driverInfo.avatar_url || null
                },
                vehicle_type: trip.vehicle_type,
                price_per_seat: parseFloat(trip.price_per_seat),
                from_location: trip.from_location,
                to_location: trip.to_location,
                travel_date: trip.travel_date,
                travel_time: formattedTime,
                original_time: trip.travel_time,
                available_seats: trip.available_seats,
                status: trip.status,
                preferences: {
                    ladies_only: trip.ladies_only || false,
                    no_smoking: trip.no_smoking || false,
                    pet_friendly: trip.pet_friendly || false
                },
                match_score: matchScore,
                created_at: trip.created_at,
                is_recurring: trip.is_recurring || false
            };
        });

        // Sort by match score (highest first), then by departure time
        formattedTrips.sort((a, b) => {
            if (b.match_score !== a.match_score) {
                return b.match_score - a.match_score;
            }
            // If same score, sort by earliest departure
            const dateA = new Date(`${a.travel_date}T${a.original_time}`);
            const dateB = new Date(`${b.travel_date}T${b.original_time}`);
            return dateA.getTime() - dateB.getTime();
        });

        const response = {
            success: true,
            data: formattedTrips,
            meta: {
                total: count || 0,
                page,
                limit,
                total_pages: Math.ceil((count || 0) / limit),
                has_more: (offset + formattedTrips.length) < (count || 0)
            },
            filters_applied: {
                from_location: request.from_location,
                to_location: request.to_location,
                travel_date: request.travel_date || 'any',
                seats_required,
                vehicle_type: request.vehicle_type || 'any'
            }
        };

        console.log(`🎉 Returning ${formattedTrips.length} formatted trips`);

        return new Response(
            JSON.stringify(response),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            }
        );

    } catch (error) {
        console.error('💥 Edge function error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Internal server error',
                timestamp: new Date().toISOString()
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            }
        );
    }
});

// Helper function to format time (12-hour format)
function formatTime(timeStr: string): string {
    if (!timeStr) return '';
    try {
        const [hours, minutes, seconds] = timeStr.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes.padStart(2, '0')} ${period}`;
    } catch (e) {
        console.warn('⚠️ Time formatting error:', e);
        return timeStr; // Return original if formatting fails
    }
}

// Helper function to calculate match score (0-100)
function calculateMatchScore(trip: any, request: any): number {
    let score = 50; // Start with base score

    // 1. Location match (max 30 points)
    const fromMatch = trip.from_location.toLowerCase().includes(request.from_location.toLowerCase()) ? 15 : 0;
    const toMatch = trip.to_location.toLowerCase().includes(request.to_location.toLowerCase()) ? 15 : 0;
    score += fromMatch + toMatch;

    // 2. Date match (20 points)
    if (request.travel_date && trip.travel_date === request.travel_date) {
        score += 20;
    }

    // 3. Vehicle type match (10 points)
    if (request.vehicle_type && request.vehicle_type !== 'any' &&
        trip.vehicle_type === request.vehicle_type) {
        score += 10;
    }

    // 4. Seat availability bonus (10 points)
    if (trip.available_seats >= (request.seats_required || 1)) {
        score += 10;
    }

    // 5. Price normalization (adjust based on average price)
    const avgPrice = 500; // Average trip price in your system
    const tripPrice = parseFloat(trip.price_per_seat);
    if (tripPrice <= avgPrice) {
        score += 10; // Bonus for affordable trips
    } else {
        const pricePenalty = ((tripPrice - avgPrice) / avgPrice) * 20;
        score -= Math.min(pricePenalty, 20);
    }

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}
