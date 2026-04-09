import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

class PaymentService {
    /**
     * Create a Cashfree order via Edge Function
     */
    async createPaymentOrder(paymentId, bookingId) {
        try {
            const body = {};
            if (paymentId) body.payment_id = paymentId;
            if (bookingId) body.booking_id = bookingId;

            const { data, error } = await supabase.functions.invoke('create-cashfree-order', {
                body
            });

            if (error) {
                // Extract actual error string from the Edge Function response if available
                let errorMessage = error.message;
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const errorDetails = await error.context.json();
                        errorMessage = errorDetails?.error || errorMessage;
                    }
                } catch(e) { /* ignore */ }
                throw new Error(errorMessage);
            }

            if (!data.success) throw new Error(data.error || 'Failed to create payment order');

            return data;
        } catch (error) {
            console.error('Payment order error:', error);
            throw error;
        }
    }

    /**
     * Poll payment status until it's paid or fails
     */
    async pollPaymentStatus(paymentId, maxAttempts = 10, intervalMs = 3000) {
        let attempts = 0;

        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                try {
                    attempts++;
                    const { data, error } = await supabase
                        .from('ride_payments')
                        .select('payment_status')
                        .eq('id', paymentId)
                        .single();

                    if (error) throw error;

                    if (data.payment_status === 'paid') {
                        resolve(true);
                        return;
                    }

                    if (attempts >= maxAttempts) {
                        resolve(false); // Timeout, still pending
                        return;
                    }

                    setTimeout(checkStatus, intervalMs);
                } catch (err) {
                    console.error('Polling error:', err);
                    reject(err);
                }
            };

            checkStatus();
        });
    /**
     * Force verify a Cashfree payment status via Edge Function
     */
    async verifyCashfreePayment(orderId) {
        try {
            const { data, error } = await supabase.functions.invoke('verify-cashfree-payment', {
                body: { order_id: orderId }
            });

            if (error) {
                console.error('Verify function error:', error);
                throw new Error(error.message || 'Verification failed');
            }

            return data; // returns { success, status, is_paid }
        } catch (error) {
            console.error('Payment verification error:', error);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();
