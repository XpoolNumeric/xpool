import { supabase } from '../supabaseClient';

export const bookingService = {
    // Create a booking request
    // Create a booking request
    async createBookingRequest(tripId, bookingData) {
        try {
            // Get current session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Authentication required');
            }

            // Call Edge Function to handle booking logic and notifications
            const { data, error } = await supabase.functions.invoke('book-trip', {
                body: {
                    trip_id: tripId,
                    passenger_id: session.user.id,
                    seats_requested: bookingData.seats_requested,
                    message: bookingData.message,
                    payment_mode: bookingData.payment_mode || 'cod'
                }
            });

            if (error) {
                console.error('Edge Function Error:', error);
                throw new Error('Failed to connect to booking service');
            }

            if (!data.success) {
                throw new Error(data.error || 'Booking failed');
            }

            return data.data;

        } catch (error) {
            console.error('Booking service error:', error);
            throw error;
        }
    },

    // Get driver's pending booking requests
    async getDriverPendingRequests() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    trip:trips(
                        from_location,
                        to_location,
                        travel_date,
                        travel_time,
                        price_per_seat,
                        vehicle_type
                    ),
                    passenger:auth.users(email)
                `)
                .eq('driver_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('Error fetching driver requests:', error);
            throw error;
        }
    },

    // Get passenger's bookings
    async getPassengerBookings() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    trip:trips(*),
                    driver:auth.users(email)
                `)
                .eq('passenger_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('Error fetching passenger bookings:', error);
            throw error;
        }
    },

    // Update booking status (driver accept/reject)
    async updateBookingStatus(bookingId, status) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            // Verify driver owns the booking
            const { data: booking } = await supabase
                .from('booking_requests')
                .select('driver_id')
                .eq('id', bookingId)
                .single();

            if (!booking || booking.driver_id !== user.id) {
                throw new Error('Unauthorized to update this booking');
            }

            // Update booking status
            const { data, error } = await supabase
                .from('booking_requests')
                .update({
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .select()
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error updating booking status:', error);
            throw error;
        }
    },

    // Cancel booking (passenger)
    async cancelBooking(bookingId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            const { data, error } = await supabase
                .from('booking_requests')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .eq('passenger_id', user.id)
                .eq('status', 'pending')
                .select()
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error cancelling booking:', error);
            throw error;
        }
    },

    // Get booking by ID
    async getBookingById(bookingId) {
        try {
            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    trip:trips(*),
                    passenger:auth.users(email),
                    driver:auth.users(email)
                `)
                .eq('id', bookingId)
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error fetching booking:', error);
            throw error;
        }
    }
};
