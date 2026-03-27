// utils/pricingService.js
import { supabase } from '../supabaseClient'
import distanceCalculator from './distanceCalculator'

export class PricingService {

    // Map edge function response to frontend-expected flat structure
    static mapFareResponse(data) {
        return {
            // Flat fare fields the frontend expects
            perPersonFare: data.fare?.perPerson || 0,
            totalFare: data.fare?.total || 0,
            tier: data.tripDetails?.tier || '',
            minPassengersRequired: data.passengers?.required || 2,
            maxPassengers: data.passengers?.maxPassengers || 4,
            currentBooked: data.passengers?.currentBooked || 1,

            // Driver earnings (flat)
            driverEarningPerPerson: data.earnings?.perPersonDriver || 0,
            totalDriverEarning: data.earnings?.totalDriver || 0,
            totalCommission: data.earnings?.totalCommission || 0,
            commissionRate: data.earnings?.commissionRate || '15%',

            // Savings - kept as flat numbers for React rendering
            savings: {
                vsTaxi: data.savings?.vsTaxi || 0,
                vsBus: data.savings?.vsBus || 0,
                taxiPrice: data.savings?.taxiPrice || 0,
                busPrice: data.savings?.busPrice || 0,
                trainPrice: data.savings?.trainPrice || 0
            },

            // Cost breakdown
            costBreakdown: data.costBreakdown || null,

            // Fare breakdown for passenger grid
            fareBreakdown: data.passengers?.fareBreakdown || {},

            // Trip details
            tripDetails: data.tripDetails || {},

            // Full breakdown
            breakdown: data.breakdown || {},

            // Preserve the raw data too
            _raw: data
        }
    }

    // Calculate fare using Google Maps + Edge Function
    static async calculateFareFromAddresses(origin, destination, vehicleType, passengers = 1) {
        try {
            // Step 1: Get distance & time from Google Maps
            const routeInfo = await distanceCalculator.getRouteInfo(origin, destination)

            // Convert to km and minutes
            const distanceKm = routeInfo.distance.value / 1000
            const durationMin = (routeInfo.durationInTraffic?.value || routeInfo.duration.value) / 60

            // Step 2: Call Supabase Edge Function
            // Get current session for auth token
            const { data: { session } } = await supabase.auth.getSession()
            let token = session?.access_token

            if (!token) {
                const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
                token = refreshedSession?.access_token
            }

            const { data, error } = await supabase.functions.invoke('calculate-fare', {
                body: {
                    distanceKm,
                    durationMin,
                    vehicleType,
                    passengers
                },
                headers: token ? {
                    Authorization: `Bearer ${token}`
                } : {}
            })

            if (error) {
                console.error('Edge function error:', error)
                throw new Error('Failed to calculate fare')
            }

            if (!data || !data.data) {
                console.error('Edge function returned invalid data:', data)
                throw new Error('Invalid fare data received')
            }

            // Map nested response to flat structure + add route info
            const mapped = this.mapFareResponse(data.data)
            mapped.routeInfo = {
                distance: routeInfo.distance.text,
                duration: routeInfo.durationInTraffic?.text || routeInfo.duration.text,
                distanceKm,
                durationMin,
                origin,
                destination
            }

            return mapped

        } catch (error) {
            console.error('Pricing calculation error:', error)
            throw error
        }
    }

    // Calculate sample fares for different passenger counts
    static async getFareBreakdown(origin, destination, vehicleType) {
        const breakdowns = []
        let routeInfo = null

        // Calculate for passengers 1 to 4
        for (let passengers = 1; passengers <= 4; passengers++) {
            try {
                const fare = await this.calculateFareFromAddresses(origin, destination, vehicleType, passengers)

                // Capture route info from first successful call
                if (!routeInfo && fare.routeInfo) {
                    routeInfo = fare.routeInfo
                }

                breakdowns.push({
                    passengers,
                    fare: fare.perPersonFare,
                    driverEarning: fare.totalDriverEarning,
                    minPassengers: fare.minPassengersRequired,
                    tier: fare.tier
                })
            } catch (error) {
                console.error(`Error calculating for ${passengers} passengers:`, error)
                // Continue loop even if one fails
            }
        }

        return {
            breakdowns,
            routeInfo
        }
    }
}