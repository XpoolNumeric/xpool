import { supabase } from '../supabaseClient';

export const tripService = {
    // Get available trips
    async getAvailableTrips(filters = {}) {
        try {
            let query = supabase
                .from('trips')
                .select('*')
                .eq('status', 'active')
                .gte('available_seats', 1)
                .gte('travel_date', new Date().toISOString().split('T')[0])
                .order('travel_date', { ascending: true })
                .order('travel_time', { ascending: true });

            // Apply filters
            if (filters.from) {
                query = query.ilike('from_location', `%${filters.from}%`);
            }
            if (filters.to) {
                query = query.ilike('to_location', `%${filters.to}%`);
            }
            if (filters.date) {
                query = query.eq('travel_date', filters.date);
            }
            if (filters.vehicle_type && filters.vehicle_type !== 'any') {
                query = query.eq('vehicle_type', filters.vehicle_type);
            }
            if (filters.max_price) {
                query = query.lte('price_per_seat', filters.max_price);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Check if user already booked these trips
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userBookings } = await supabase
                    .from('booking_requests')
                    .select('trip_id')
                    .eq('passenger_id', user.id)
                    .in('status', ['pending', 'approved']);

                const bookedTripIds = userBookings?.map(b => b.trip_id) || [];
                return data.filter(trip => !bookedTripIds.includes(trip.id));
            }

            return data || [];

        } catch (error) {
            console.error('Error fetching trips:', error);
            throw error;
        }
    },

    // Get trip by ID
    async getTripById(tripId) {
        try {
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error fetching trip:', error);
            throw error;
        }
    },

    // Get driver's trips
    async getDriverTrips() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', user.id)
                .order('travel_date', { ascending: false })
                .order('travel_time', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('Error fetching driver trips:', error);
            throw error;
        }
    }
};
