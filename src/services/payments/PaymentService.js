import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

class PaymentService {
    /**
     * Create a Razorpay order via Edge Function
     */
    async createPaymentOrder(paymentId, bookingId) {
        try {
            const body = {};
            if (paymentId) body.payment_id = paymentId;
            if (bookingId) body.booking_id = bookingId;

            let { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const refreshRes = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
                session = refreshRes.data?.session;
            }

            const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
                body,
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (error) {
                let errorMessage = error.message;
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const errorDetails = await error.context.json();
                        errorMessage = errorDetails?.error || errorMessage;
                    }
                } catch (e) { /* ignore */ }
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
     * Verify a Razorpay payment signature via Edge Function
     */
    async verifyRazorpayPayment(verificationPayload) {
        try {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const refreshRes = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
                session = refreshRes.data?.session;
            }

            const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
                body: verificationPayload,
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (error) {
                let errorMessage = error.message;
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const errorDetails = await error.context.json();
                        errorMessage = errorDetails?.error || errorMessage;
                    }
                } catch (e) { /* ignore */ }
                throw new Error(errorMessage);
            }

            if (!data.success) throw new Error(data.error || 'Payment verification failed');

            return data; // returns { success, status, is_paid }
        } catch (error) {
            console.error('Payment verification error:', error);
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
    }
}

export const paymentService = new PaymentService();
