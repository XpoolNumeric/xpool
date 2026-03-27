// utils/distanceCalculator.js
import { calculateDistance } from './googleMapsHelper';

class DistanceCalculator {
    async getRouteInfo(origin, destination) {
        try {
            const result = await calculateDistance(origin, destination);

            // Format to match what PricingService expects
            return {
                distance: {
                    text: result.distance,
                    value: result.distanceValue
                },
                duration: {
                    text: result.duration,
                    value: result.durationValue
                },
                // Add fallback for durationInTraffic if not available from basic distance matrix
                durationInTraffic: {
                    text: result.duration,
                    value: result.durationValue
                }
            };
        } catch (error) {
            console.error('Distance calculation error:', error);
            throw error;
        }
    }
}

export default new DistanceCalculator();
