// index.ts (Advanced Search Trips with Geometric Intersection Logic)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Advanced Search Trips Edge Function using Geographic Math")

// Local simple cache for geocoding to prevent hitting Google APIs excessively
const geocodeCache = new Map<string, {lat: number, lng: number} | null>();

// Geocode user input address into Lat/Lng
async function geocodeLocation(address: string): Promise<{lat: number, lng: number} | null> {
    if (!address) return null;
    const cacheKey = address.toLowerCase().trim();
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
        console.warn("Missing GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY. Advanced geographic matching will fallback.");
        return null;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            geocodeCache.set(cacheKey, loc);
            return loc;
        }
        geocodeCache.set(cacheKey, null);
    } catch (e) {
        console.error("Geocode error:", address, e);
    }
    return null;
}

// Haversine formula to get straight-line distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Format date helper
function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    try {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-IN', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        })
    } catch {
        return dateStr
    }
}

// Format time helper
function formatTime(timeStr: string): string {
    if (!timeStr) return ''
    try {
        const [hours, minutes] = timeStr.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes} ${ampm}`
    } catch {
        return timeStr
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (req.method !== 'POST') {
            throw new Error('Method not allowed')
        }

        const {
            fromLocation,
            toLocation,
            travelDate,
            vehiclePreference = 'any',
            page = 1,
            pageSize = 20,
        } = await req.json()

        // Input validation
        if (!fromLocation?.trim() || !toLocation?.trim()) {
            throw new Error('From and To locations are required')
        }
        
        if (page < 1) {
            throw new Error('Page must be >= 1')
        }
        
        if (pageSize < 1 || pageSize > 100) {
            throw new Error('Page size must be between 1 and 100')
        }
        
        // Validate travel date format if provided
        if (travelDate && !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
            throw new Error('Invalid travel_date format. Use YYYY-MM-DD')
        }

        // Check for Google Maps API key
        if (!Deno.env.get('GOOGLE_MAPS_API_KEY') && !Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')) {
            console.warn('⚠️ API KEY not set - geographic matching disabled')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false } }
        )

        console.log(`Smart Geographic search: "${fromLocation}" → "${toLocation}"`)

        // 1. Fetch available trips mathematically (no strict string filtering in DB)
        // We use the 'trips' table directly so we can grab all active ones for the date/type
        let query = supabaseClient
            .from('trips')
            .select('*')
            .eq('status', 'active')
            .gt('available_seats', 0)
            
        if (travelDate) {
            query = query.eq('travel_date', travelDate);
        }
        
        if (vehiclePreference !== 'any') {
            query = query.eq('vehicle_type', vehiclePreference);
        }

        const { data: allTripsData, error } = await query.limit(500);

        if (error) throw error;
        const allTrips = allTripsData || [];

        // 2. Geocode the USER's search terms
        const searchFromGeo = await geocodeLocation(fromLocation);
        const searchToGeo = await geocodeLocation(toLocation);

        const searchFromLower = fromLocation.toLowerCase();
        const searchToLower = toLocation.toLowerCase();

        const matches: any[] = [];

        // 3. Evaluate every trip against the Search Coordinates
        for (const trip of allTrips) {
            const tripFrom = trip.from_location?.toLowerCase() || '';
            const tripTo = trip.to_location?.toLowerCase() || '';

            let matchType = null;
            let matchScore = 0;
            let matchReason = '';

            // Fast Exact String Match
            if (tripFrom.includes(searchFromLower) && tripTo.includes(searchToLower)) {
                matchType = 'exact';
                matchScore = 100;
                matchReason = 'Exact location match';
            } 
            // Geographic Math matching
            // We resolve the Trip's lat/lng either from the DB, or dynamically geocode them if missing!
            let tripStartGeo = (trip.start_lat && trip.start_lng) 
                ? { lat: trip.start_lat, lng: trip.start_lng } 
                : await geocodeLocation(trip.from_location);
            
            let tripEndGeo = (trip.end_lat && trip.end_lng)
                ? { lat: trip.end_lat, lng: trip.end_lng }
                : await geocodeLocation(trip.to_location);

            if (!matchType && searchFromGeo && searchToGeo && tripStartGeo && tripEndGeo) {
                const P_s = searchFromGeo;
                const P_e = searchToGeo;
                const D_s = tripStartGeo;
                const D_e = tripEndGeo;

                const distPassengerDirect = calculateDistance(P_s.lat, P_s.lng, P_e.lat, P_e.lng);
                const distDriverDirect = calculateDistance(D_s.lat, D_s.lng, D_e.lat, D_e.lng);

                const startProximity = calculateDistance(P_s.lat, P_s.lng, D_s.lat, D_s.lng);
                const endProximity = calculateDistance(P_e.lat, P_e.lng, D_e.lat, D_e.lng);

                // A. Proximity Match (e.g. Alias: "Tanjore" vs "Thanjavur")
                if (startProximity <= 15 && endProximity <= 15) {
                    matchType = 'proximity';
                    matchScore = 95;
                    matchReason = 'Very close geographic match (Alias/Nearby)';
                } else {
                    // Geometric Segment overlaps
                    // Tolerates ~30% math curvature detour for winding routes
                    
                    // Case B: Passenger search is a SUB-SEGMENT of the Driver's trip 
                    // (User wants Chengalpattu->Gingee, Driver goes Chennai->Gingee)
                    const pd1 = calculateDistance(D_s.lat, D_s.lng, P_s.lat, P_s.lng);
                    const pd2 = distPassengerDirect;
                    const pd3 = calculateDistance(P_e.lat, P_e.lng, D_e.lat, D_e.lng);
                    
                    if ((pd1 + pd2 + pd3) <= (distDriverDirect * 1.30) && distPassengerDirect > 5) {
                        matchType = 'passenger_sub_route';
                        matchScore = 85; 
                        matchReason = `Trip passes through your route`;
                        
                        // Dynamic Prorating
                        if (trip.price_per_seat && distDriverDirect > 0) {
                            trip.original_price_per_seat = trip.price_per_seat;
                            const distanceRatio = distPassengerDirect / distDriverDirect;
                            const clampedRatio = Math.max(0.1, Math.min(distanceRatio, 1.0));
                            let proratedPrice = trip.price_per_seat * clampedRatio;
                            // Round to nearest 5 rupees, minimum fare 50
                            trip.price_per_seat = Math.max(50, Math.round(proratedPrice / 5) * 5);
                            trip.is_prorated = true;
                        }
                    }
                }
            }
            
            // Fallbacks if Google Maps geocoding fails or coords are missing from the table
            if (!matchType) {
                // String proximity or basic inclusiveness
                if (tripFrom.includes(searchFromLower.split(',')[0]) && tripTo.includes(searchToLower.split(',')[0])) {
                    matchType = 'partial_string';
                    matchScore = 60;
                    matchReason = 'Partial text match';
                }
            }

            if (matchType) {
                matches.push({
                    ...trip,
                    match_type: matchType,
                    match_score: matchScore,
                    match_reason: matchReason
                });
            }
        }

        // Sort Highest Score First
        matches.sort((a, b) => b.match_score - a.match_score);

        // Calculate metadata & Pagination
        const totalCount = matches.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedTrips = matches.slice(startIndex, startIndex + pageSize);
        const hasMore = (page * pageSize) < totalCount;

        const formattedTrips = paginatedTrips.map((trip: any) => ({
            ...trip,
            formatted_date: formatDate(trip.travel_date),
            formatted_time: formatTime(trip.travel_time),
            match_info: {
                type: trip.match_type,
                score: trip.match_score,
                reason: trip.match_reason,
            },
            // Format driver object cleanly if fetched (removed since frontend fetches it)
            driver: null,
            price_display: `₹${trip.price_per_seat}`,
            seats_display: `${trip.available_seats} seat${trip.available_seats > 1 ? 's' : ''}`,
            vehicle_icon: trip.vehicle_type === 'car' ? '🚗' : '🏍️'
        }));

        return new Response(
            JSON.stringify({
                success: true,
                data: formattedTrips,
                metadata: {
                    statistics: { 
                        total: totalCount, 
                        exact_matches: matches.filter(m => m.match_type === 'exact').length,
                        proximity_matches: matches.filter(m => m.match_type === 'proximity').length,
                        subroute_matches: matches.filter(m => m.match_type === 'passenger_sub_route' || m.match_type === 'driver_sub_route').length,
                        has_more: hasMore 
                    },
                    pagination: { 
                        current_page: page, 
                        page_size: pageSize, 
                        total_count: totalCount, 
                        has_more: hasMore, 
                        total_pages: Math.ceil(totalCount / pageSize) 
                    },
                },
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Function Error:', error.message)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
