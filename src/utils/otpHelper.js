import { supabase } from '../supabaseClient';

/**
 * OTP Helper Functions
 * Handles OTP generation, storage, and verification for trips
 */

/**
 * Generate a 4-digit OTP
 * @returns {string} 4-digit OTP
 */
export const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Save OTP to trip in database
 * @param {string} tripId - Trip UUID
 * @param {string} otp - Generated OTP
 * @returns {Promise<object>} Updated trip data
 */
export const saveOTPToTrip = async (tripId, otp) => {
    try {
        const { data, error } = await supabase
            .from('trips')
            .update({
                otp_code: otp,
                otp_generated_at: new Date().toISOString(),
            })
            .eq('id', tripId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error saving OTP to trip:', error);
        throw error;
    }
};

/**
 * Verify OTP for a trip
 * @param {string} tripId - Trip UUID
 * @param {string} enteredOTP - OTP entered by user
 * @returns {Promise<boolean>} True if OTP is valid
 */
export const verifyOTP = async (tripId, enteredOTP) => {
    try {
        const { data: trip, error } = await supabase
            .from('trips')
            .select('otp_code, otp_generated_at, travel_date')
            .eq('id', tripId)
            .single();

        if (error) throw error;

        if (!trip || !trip.otp_code) {
            return false;
        }

        // Check if OTP matches
        if (trip.otp_code !== enteredOTP) {
            return false;
        }

        // Check if OTP is still valid (within 24 hours of generation)
        const otpGeneratedAt = new Date(trip.otp_generated_at);
        const now = new Date();
        const hoursSinceGeneration = (now - otpGeneratedAt) / (1000 * 60 * 60);

        if (hoursSinceGeneration > 24) {
            return false; // OTP expired
        }

        return true;
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return false;
    }
};

/**
 * Generate and save OTP for a trip
 * @param {string} tripId - Trip UUID
 * @returns {Promise<string>} Generated OTP
 */
export const generateAndSaveOTP = async (tripId) => {
    const otp = generateOTP();
    await saveOTPToTrip(tripId, otp);
    return otp;
};

/**
 * Send OTP notification to passenger
 * @param {string} passengerId - Passenger user ID
 * @param {string} otp - Generated OTP
 * @param {object} tripDetails - Trip information
 * @returns {Promise<void>}
 */
export const sendOTPNotification = async (passengerId, otp, tripDetails) => {
    try {
        // Create in-app notification
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: passengerId,
                type: 'otp_generated',
                title: 'Trip OTP Generated',
                message: `Your trip OTP is: ${otp}. Share this with your driver to start the journey.`,
                reference_id: tripDetails.id,
            });

        if (error) throw error;
    } catch (error) {
        console.error('Error sending OTP notification:', error);
        throw error;
    }
};

/**
 * Get OTP for a trip (for passenger to view)
 * @param {string} tripId - Trip UUID
 * @returns {Promise<string|null>} OTP or null if not generated
 */
export const getOTPForTrip = async (tripId) => {
    try {
        const { data: trip, error } = await supabase
            .from('trips')
            .select('otp_code, travel_date')
            .eq('id', tripId)
            .single();

        if (error) throw error;

        // Only return OTP if trip is today
        const tripDate = new Date(trip.travel_date);
        const today = new Date();

        if (
            tripDate.getDate() === today.getDate() &&
            tripDate.getMonth() === today.getMonth() &&
            tripDate.getFullYear() === today.getFullYear()
        ) {
            return trip.otp_code;
        }

        return null;
    } catch (error) {
        console.error('Error getting OTP for trip:', error);
        return null;
    }
};

/**
 * Check if OTP should be generated for trip (trip is today)
 * @param {string} travelDate - Travel date (YYYY-MM-DD)
 * @returns {boolean} True if OTP should be generated
 */
export const shouldGenerateOTP = (travelDate) => {
    const tripDate = new Date(travelDate);
    const today = new Date();

    return (
        tripDate.getDate() === today.getDate() &&
        tripDate.getMonth() === today.getMonth() &&
        tripDate.getFullYear() === today.getFullYear()
    );
};
