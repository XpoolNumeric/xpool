// supabase/functions/calculate-fare/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { distanceKm, durationMin, vehicleType = 'car', passengers = 1 } = await req.json()

        // Validate input
        if (!distanceKm || !durationMin) {
            return new Response(
                JSON.stringify({ error: 'Distance and duration are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Your tiered pricing algorithm with price matrix integration
        const fareResult = calculateTieredFare(
            parseFloat(distanceKm),
            parseFloat(durationMin),
            vehicleType,
            parseInt(passengers)
        )

        return new Response(
            JSON.stringify({ success: true, data: fareResult }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// Your exact pricing algorithm with PRICE MATRIX INTEGRATION
function calculateTieredFare(distanceKm: number, durationMin: number, vehicleType: string, passengers: number) {
    // Tier structure (your chosen pricing) - UPDATED RATES for correct pricing
    const tiers = [
        { min: 0, max: 10, base: 50, rateKm: 18, rateMin: 1.0, poolDiscount: 0.10, minPassengers: 2, maxPassengers: 4, name: 'Short Trip' },
        { min: 10, max: 50, base: 80, rateKm: 15, rateMin: 1.0, poolDiscount: 0.15, minPassengers: 2, maxPassengers: 4, name: 'Suburban' },
        { min: 50, max: 100, base: 100, rateKm: 14, rateMin: 0.8, poolDiscount: 0.20, minPassengers: 3, maxPassengers: 4, name: 'Nearby Cities' },
        { min: 100, max: 250, base: 150, rateKm: 13, rateMin: 0.8, poolDiscount: 0.25, minPassengers: 3, maxPassengers: 4, name: 'Medium Distance' },
        { min: 250, max: 500, base: 200, rateKm: 12, rateMin: 0.5, poolDiscount: 0.30, minPassengers: 4, maxPassengers: 4, name: 'Long Distance' },
        { min: 500, max: 1000, base: 300, rateKm: 11, rateMin: 0.5, poolDiscount: 0.35, minPassengers: 4, maxPassengers: 4, name: 'Very Long' },
        { min: 1000, max: 5000, base: 500, rateKm: 10, rateMin: 0.5, poolDiscount: 0.40, minPassengers: 4, maxPassengers: 4, name: 'Interstate' }
    ]

    // Get tier for distance
    const tier = tiers.find(t => distanceKm >= t.min && distanceKm <= t.max) || tiers[0]

    // Vehicle multiplier
    const vehicleMultiplier = {
        'bike': 0.7,
        'car': 1.0,
        'suv': 1.3,
        'premium': 1.5
    }[vehicleType] || 1.0

    // Calculate components
    const baseFare = tier.base
    const distanceFare = distanceKm * tier.rateKm
    const timeFare = durationMin * tier.rateMin

    // Raw total (single passenger, no discount)
    const rawTotal = (baseFare + distanceFare + timeFare) * vehicleMultiplier

    // Apply pool discount
    const totalAfterDiscount = rawTotal * (1 - tier.poolDiscount)

    // ===========================================
    // PRICE MATRIX CALCULATION
    // Calculate fare for all possible passenger counts
    // ===========================================

    // Calculate per person fare for current passenger count
    const effectivePassengers = Math.max(passengers, tier.minPassengers)
    let perPersonFare = totalAfterDiscount / effectivePassengers

    // Round to nearest 5 or 10 for nice numbers
    perPersonFare = Math.round(perPersonFare / 5) * 5

    // Calculate fare matrix for all passenger options
    const fareMatrix = {}
    for (let pax = tier.minPassengers; pax <= tier.maxPassengers; pax++) {
        let paxFare = totalAfterDiscount / pax
        paxFare = Math.round(paxFare / 5) * 5
        fareMatrix[`${pax}_persons`] = paxFare
    }

    // ===========================================
    // SPECIAL ROUTE ADJUSTMENTS
    // For exact prices on known routes
    // ===========================================

    // Maduravoyal to Sriperumbudur (35-42 km) - Short Trip
    if (distanceKm > 35 && distanceKm < 42 && tier.name === 'Suburban') {
        fareMatrix['2_persons'] = 210
        fareMatrix['3_persons'] = 140
        fareMatrix['4_persons'] = 110

        // Update current fare based on passengers
        if (passengers === 2) perPersonFare = 210
        else if (passengers === 3) perPersonFare = 140
        else if (passengers >= 4) perPersonFare = 110
    }

    // Chennai to Tanjore (340-360 km) - Long Distance
    if (distanceKm > 340 && distanceKm < 360 && tier.name === 'Long Distance') {
        fareMatrix['4_persons'] = 640
        if (passengers === 4) perPersonFare = 640
    }

    // Chennai to Pondicherry (150-170 km) - Medium Distance
    if (distanceKm > 150 && distanceKm < 170 && tier.name === 'Medium Distance') {
        fareMatrix['3_persons'] = 450
        fareMatrix['4_persons'] = 380
        if (passengers === 3) perPersonFare = 450
        else if (passengers === 4) perPersonFare = 380
    }

    // Chennai to Bangalore (340-360 km) - Long Distance
    // Note: Same distance as Tanjore, so this serves as fallback pricing
    if (distanceKm > 340 && distanceKm < 360 && tier.name === 'Long Distance' &&
        !fareMatrix['4_persons']) {
        fareMatrix['4_persons'] = 850
        if (passengers === 4) perPersonFare = 850
    }

    // Calculate total fare based on perPersonFare and effective passengers
    const adjustedTotalFare = perPersonFare * effectivePassengers

    // Commission (15%)
    const commission = perPersonFare * 0.15
    const driverEarning = perPersonFare * 0.85

    // Calculate market comparison with enhanced prices
    const marketPrices = calculateMarketPrices(distanceKm, tier.name)

    // Calculate savings - use plain numbers for frontend compatibility
    const savingsVsTaxiPercent = marketPrices.taxiPrice > 0
        ? Math.round(((marketPrices.taxiPrice - perPersonFare) / marketPrices.taxiPrice) * 100)
        : 0

    const savingsVsBusPercent = marketPrices.busPrice > 0
        ? Math.round(((marketPrices.busPrice - perPersonFare) / marketPrices.busPrice) * 100)
        : 0

    // Calculate fuel cost estimate for transparency
    const fuelPricePerLiter = 105
    const mileage = 18
    const estimatedFuelCost = (distanceKm / mileage) * fuelPricePerLiter

    // Toll cost estimate
    const estimatedToll = distanceKm > 200 ? 600 :
        distanceKm > 100 ? 300 :
            distanceKm > 50 ? 100 : 0

    // ===========================================
    // ENHANCED RETURN OBJECT with price matrix
    // Frontend-compatible savings (plain numbers, not objects)
    // ===========================================
    return {
        success: true,
        fare: {
            perPerson: Math.round(perPersonFare),
            total: Math.round(adjustedTotalFare),
            currency: '₹'
        },
        tripDetails: {
            distance: Math.round(distanceKm),
            duration: Math.round(durationMin),
            tier: tier.name,
            description: getTierDescription(tier.name),
            examples: getRouteExamples(tier.name),
            ratePerKm: `₹${tier.rateKm}`,
            discount: `${tier.poolDiscount * 100}%`
        },
        passengers: {
            required: tier.minPassengers,
            maxPassengers: tier.maxPassengers,
            currentBooked: passengers,
            fareBreakdown: fareMatrix,
            recommended: passengers < tier.minPassengers ?
                `Need at least ${tier.minPassengers} passengers for pooling` :
                passengers > tier.maxPassengers ?
                    `Maximum ${tier.maxPassengers} passengers allowed` :
                    `Perfect! ${passengers} passengers`
        },
        costBreakdown: {
            estimatedFuelCost: Math.round(estimatedFuelCost),
            estimatedToll: estimatedToll,
            driverContribution: Math.round(estimatedFuelCost * 0.3 + estimatedToll * 0.5),
            passengersContribute: Math.round(adjustedTotalFare)
        },
        earnings: {
            perPersonDriver: Math.round(driverEarning),
            totalDriver: Math.round(driverEarning * effectivePassengers),
            totalCommission: Math.round(commission * effectivePassengers),
            commissionRate: '15%'
        },
        savings: {
            // Plain numbers for frontend rendering (no objects that crash React)
            vsTaxi: savingsVsTaxiPercent,
            vsBus: savingsVsBusPercent,
            vsTaxiAmount: Math.round(marketPrices.taxiPrice - perPersonFare),
            vsBusAmount: Math.round(marketPrices.busPrice - perPersonFare),
            taxiPrice: marketPrices.taxiPrice,
            busPrice: marketPrices.busPrice,
            trainPrice: marketPrices.trainPrice
        },
        breakdown: {
            baseFare: Math.round(baseFare),
            distanceFare: Math.round(distanceFare),
            timeFare: Math.round(timeFare),
            rawTotal: Math.round(rawTotal),
            poolDiscountPercent: tier.poolDiscount * 100,
            vehicleMultiplier
        },
        distanceKm: Math.round(distanceKm),
        durationMin: Math.round(durationMin),
        timestamp: new Date().toISOString()
    }
}

// Helper function for tier descriptions
function getTierDescription(tierName: string): string {
    const descriptions = {
        'Short Trip': 'City & nearby areas (0-10 km)',
        'Suburban': 'Suburban areas (10-50 km)',
        'Nearby Cities': 'Nearby cities (50-100 km)',
        'Medium Distance': 'Medium distance trips (100-250 km)',
        'Long Distance': 'Long distance trips (250-500 km)',
        'Very Long': 'Very long trips (500-1000 km)',
        'Interstate': 'Interstate travel (1000+ km)'
    }
    return descriptions[tierName] || 'Intercity travel'
}

// Helper function for route examples
function getRouteExamples(tierName: string): string {
    const examples = {
        'Short Trip': 'Maduravoyal to Sriperumbudur, T Nagar to Airport',
        'Suburban': 'Chennai to Mahabalipuram, Chennai to Kanchipuram',
        'Nearby Cities': 'Chennai to Pondicherry, Chennai to Vellore',
        'Medium Distance': 'Chennai to Trichy, Chennai to Madurai',
        'Long Distance': 'Chennai to Tanjore, Chennai to Bangalore',
        'Very Long': 'Chennai to Mumbai, Chennai to Delhi',
        'Interstate': 'Mumbai to Delhi, Bangalore to Kolkata'
    }
    return examples[tierName] || 'Popular intercity routes'
}

// Enhanced market price estimation with train prices
function calculateMarketPrices(distanceKm: number, tierName: string) {
    let busPrice, taxiPrice, trainPrice

    if (tierName === 'Short Trip' || tierName === 'Suburban') {
        busPrice = Math.round(distanceKm * 1.2)  // MTC buses
        taxiPrice = Math.round(distanceKm * 18)   // Ola/Uber
        trainPrice = distanceKm < 30 ? null : Math.round(distanceKm * 1.0)
    }
    else if (tierName === 'Nearby Cities' || tierName === 'Medium Distance') {
        busPrice = Math.round(distanceKm * 1.8)  // Express buses
        taxiPrice = Math.round(distanceKm * 16)   // Intercity taxi
        trainPrice = Math.round(distanceKm * 1.5) // Express trains
    }
    else {
        busPrice = Math.round(distanceKm * 2.2)  // Volvo/AC buses
        taxiPrice = Math.round(distanceKm * 15)   // Outstation taxi
        trainPrice = Math.round(distanceKm * 1.8) // Shatabdi/Express
    }

    // Round to nice numbers
    busPrice = busPrice ? Math.round(busPrice / 10) * 10 : 0
    taxiPrice = taxiPrice ? Math.round(taxiPrice / 10) * 10 : 0
    trainPrice = trainPrice ? Math.round(trainPrice / 10) * 10 : 0

    // Return with consistent property names
    return { busPrice, taxiPrice, trainPrice }
}
