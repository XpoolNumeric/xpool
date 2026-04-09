// search-trips/index.ts (Advanced version with partial matching, strict filtering, and middle-location support)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Advanced Search Trips Edge Function loaded with middle-location routing support")

// Geocoding Cache to avoid spamming the Google Maps API
const geocodeCache = new Map<string, any>();

async function geocodeLocation(address: string): Promise<{lat: number, lng: number} | null> {
    if (!address) return null;
    const cacheKey = address.toLowerCase().trim();
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || 'AIzaSyB7_39jR-kqbchHlKHzBtmWbtAbY8jrtbw';
    try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            geocodeCache.set(cacheKey, loc);
            return loc;
        }
    } catch (e) {
        console.error("Geocode error for address:", address, e);
    }
    return null;
}

// Haversine formula to calculate straight-line distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

Deno.serve(async (req) => {
    // Handle CORS preflight
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

        if (!fromLocation?.trim() || !toLocation?.trim()) {
            throw new Error('From and To locations are required')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false } }
        )

        console.log(`Searching trips from "${fromLocation}" to "${toLocation}" in advanced mode...`)

        // Fetch a large pool of trips bypassing the database-level exact string matches.
        // We do this by passing empty strings to search_from and search_to, 
        // which allows us to natively compute middle-locations via geographic coordinates.
        const { data: allTripsData, error } = await supabaseClient
            .rpc('search_trips', {
                search_from: '',
                search_to: '',
                search_date: travelDate || null,
                vehicle_pref: vehiclePreference,
                page_number: 1,
                page_size: 500 
            })

        if (error) throw error;

        const allTrips = allTripsData || [];

        // Exact substring string matching 
        const fromCity = fromLocation.split(',')[0].trim().toLowerCase();
        const toCity = toLocation.split(',')[0].trim().toLowerCase();

        const exactMatches = allTrips.filter((trip: any) => {
            const tFrom = trip.from_location?.toLowerCase() || '';
            const tTo = trip.to_location?.toLowerCase() || '';
            if (tFrom.includes(fromCity) && tTo.includes(toCity)) {
                trip.from_match_type = 'exact';
                trip.to_match_type = 'exact';
                trip.match_score = 200;
                return true;
            }
            return false;
        });

        // Resolve geographic middle location routing
        const routeMatches: any[] = [];
        
        // Geocode passenger search parameters
        const searchFromGeo = await geocodeLocation(fromLocation);
        const searchToGeo = await geocodeLocation(toLocation);

        if (searchFromGeo && searchToGeo) {
            for (const trip of allTrips) {
                // Skip if already in exact matches
                if (exactMatches.some(e => e.id === trip.id)) continue;

                const tripFromGeo = await geocodeLocation(trip.from_location);
                const tripToGeo = await geocodeLocation(trip.to_location);

                if (tripFromGeo && tripToGeo) {
                    const d1 = calculateDistance(tripFromGeo.lat, tripFromGeo.lng, searchFromGeo.lat, searchFromGeo.lng);
                    const d2 = calculateDistance(searchFromGeo.lat, searchFromGeo.lng, searchToGeo.lat, searchToGeo.lng);
                    const d3 = calculateDistance(searchToGeo.lat, searchToGeo.lng, tripToGeo.lat, tripToGeo.lng);
                    
                    const totalDirect = calculateDistance(tripFromGeo.lat, tripFromGeo.lng, tripToGeo.lat, tripToGeo.lng);

                    // A point lies roughly on a line segment if the sum of segments is near the direct distance.
                    // We allow a 20% geographical detour threshold.
                    const isAlongRoute = (d1 + d2 + d3) <= (totalDirect * 1.20);
                    
                    // Passenger must be travelling in the same direction!
                    const dStartToSearchEnd = calculateDistance(tripFromGeo.lat, tripFromGeo.lng, searchToGeo.lat, searchToGeo.lng);
                    const isCorrectOrder = d1 < dStartToSearchEnd;

                    // Ensure minimum travel length requirement so we don't accidentally match 0km searches
                    if (isAlongRoute && isCorrectOrder && totalDirect > 5) {
                        trip.from_match_type = 'route_containment';
                        trip.to_match_type = 'route_containment';
                        trip.match_score = 100;
                        routeMatches.push(trip);
                    }
                }
            }
        }

        // Combine and manually paginate
        const validTrips = [...exactMatches, ...routeMatches];
        const totalCount = validTrips.length;
        const hasMore = (page * pageSize) < totalCount;
        
        const startIndex = (page - 1) * pageSize;
        const paginatedTrips = validTrips.slice(startIndex, startIndex + pageSize);

        const exactMatchesCount = exactMatches.length;
        const partialMatchesCount = routeMatches.length;
        const fuzzyMatchesCount = 0;

        const availableVehicleTypes = [...new Set(validTrips.map((t: any) => t.vehicle_type))];
        const dateRange = validTrips.length > 0 ? {
            earliest: validTrips.reduce((min: string, t: any) => t.travel_date < min ? t.travel_date : min, validTrips[0].travel_date),
            latest: validTrips.reduce((max: string, t: any) => t.travel_date > max ? t.travel_date : max, validTrips[0].travel_date)
        } : null;

        const formattedTrips = paginatedTrips.map((trip: any) => ({
            ...trip,
            formatted_date: formatDate(trip.travel_date),
            formatted_time: formatTime(trip.travel_time),
            match_info: {
                score: trip.match_score || 0,
                from_match: trip.from_match_type || 'contains',
                to_match: trip.to_match_type || 'contains',
                is_route_containment: trip.from_match_type === 'route_containment',
                match_quality: getMatchQuality(trip.match_score || 100)
            },
            driver: trip.driver_name ? {
                name: trip.driver_name,
                avatar: trip.driver_avatar,
                rating: trip.driver_rating,
                trips_completed: trip.driver_trips_count
            } : null,
            price_display: `₹${trip.price_per_seat}`,
            seats_display: `${trip.available_seats} seat${trip.available_seats > 1 ? 's' : ''}`,
            vehicle_icon: trip.vehicle_type === 'car' ? '🚗' : '🏍️',
            share_link: `${Deno.env.get('PUBLIC_APP_URL') || ''}/trip/${trip.id}`
        }));

        return new Response(
            JSON.stringify({
                success: true,
                data: formattedTrips,
                metadata: {
                    search_criteria: { from: fromLocation, to: toLocation, date: travelDate || null, vehicle: vehiclePreference },
                    statistics: { total: totalCount, exact_matches: exactMatchesCount, partial_matches: partialMatchesCount, fuzzy_matches: fuzzyMatchesCount, has_more: hasMore },
                    pagination: { current_page: page, page_size: pageSize, total_count: totalCount, has_more: hasMore, total_pages: Math.ceil(totalCount / pageSize) },
                    filters: { available_vehicle_types: availableVehicleTypes, date_range: dateRange },
                    suggestions: generateSuggestions(formattedTrips, fromLocation, toLocation)
                },
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Function Error:', error.message)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                error_type: error.constructor.name,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: error.message === 'Method not allowed' ? 405 : 400,
            }
        )
    }
})

// Helper functions
function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    try {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
        return dateStr
    }
}

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

function getMatchQuality(score: number): string {
    if (score >= 180) return 'excellent'
    if (score >= 150) return 'good'
    if (score >= 100) return 'fair'
    if (score >= 50) return 'partial'
    return 'fuzzy'
}

function generateSuggestions(trips: any[], fromLocation: string, toLocation: string): any {
    if (trips.length === 0) {
        return {
            message: 'No direct matches found. Try:',
            alternatives: ['Searching for nearby cities', 'Checking different dates', 'Being less specific with location names', 'Trying different vehicle types'],
            popular_routes: ['Chennai to Bangalore', 'Mumbai to Pune', 'Delhi to Jaipur']
        }
    }
    const avgScore = trips.reduce((sum, t) => sum + (t.match_info?.score || 100), 0) / trips.length;
    if (avgScore < 100) {
        return {
            message: 'Showing partial matches. Tips to get exact matches:',
            tips: ['Use full city names', 'Check for spelling mistakes', 'Include state names', 'Try nearby major cities']
        }
    }
    return null;
}
