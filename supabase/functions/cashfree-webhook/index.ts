import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { encodeHex } from "https://deno.land/std@0.203.0/encoding/hex.ts";

serve(async (req) => {
    try {
        const bodyText = await req.text()
        const signature = req.headers.get('x-webhook-signature')
        const timestamp = req.headers.get('x-webhook-timestamp')

        if (!signature || !timestamp) {
            return new Response('Unauthorized', { status: 401 })
        }

        const secretKey = Deno.env.get('CASHFREE_SECRET_KEY')
        if (secretKey) {
            // Verify signature
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw",
                encoder.encode(secretKey),
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"]
            );

            const dataToSign = timestamp + bodyText;
            const sigBuffer = await crypto.subtle.sign(
                "HMAC",
                key,
                encoder.encode(dataToSign)
            );

            const computedSignature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
            if (computedSignature !== signature) {
                console.error('Signature mismatch');
                return new Response('Invalid Signature', { status: 401 })
            }
        }

        const payload = JSON.parse(bodyText)

        if (payload.type !== 'PAYMENT_SUCCESS_WEBHOOK') {
            return new Response('Ignored', { status: 200 })
        }

        const orderId = payload.data.order.order_id

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // --- WALLET RECHARGE FLOW ---
        if (orderId && orderId.startsWith('rechg_')) {
            const { data: recharge } = await supabaseAdmin
                .from('wallet_recharges')
                .select('*')
                .eq('cashfree_order_id', orderId)
                .single()

            if (!recharge) {
                return new Response('Recharge not found', { status: 404 })
            }

            if (recharge.status === 'paid') {
                return new Response('Already processed', { status: 200 })
            }

            // Update recharge status
            await supabaseAdmin
                .from('wallet_recharges')
                .update({
                    status: 'paid',
                    cashfree_payment_id: payload.data.payment.cf_payment_id?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', recharge.id)

            // Find driver's user_id to invoke RPC
            const { data: driver } = await supabaseAdmin
                .from('drivers')
                .select('user_id')
                .eq('id', recharge.driver_id)
                .single()

            if (driver) {
                try {
                    await supabaseAdmin.rpc('add_to_wallet', {
                        p_driver_user_id: driver.user_id,
                        p_amount: recharge.amount,
                        p_ride_id: recharge.id,
                        p_description: 'Wallet Top-up Complete'
                    })

                    // Notify driver
                    await supabaseAdmin.from('notifications').insert({
                        user_id: driver.user_id,
                        type: 'wallet_recharge',
                        title: 'Funds Added!',
                        message: `Successfully added ₹${recharge.amount} to your wallet.`,
                        data: { recharge_id: recharge.id }
                    })
                } catch (walletErr) {
                    console.error('Wallet recharge error:', walletErr)
                }
            }

            return new Response('Success', { status: 200 })
        }

        // --- RIDE PAYMENTS FLOW ---
        // Get payment
        const { data: payment } = await supabaseAdmin
            .from('ride_payments')
            .select('*')
            .eq('cashfree_order_id', orderId)
            .single()

        if (!payment) {
            return new Response('Payment not found', { status: 404 })
        }

        if (payment.payment_status === 'paid') {
            return new Response('Already processed', { status: 200 })
        }

        // Update payment status
        const { error: updateErr } = await supabaseAdmin
            .from('ride_payments')
            .update({
                payment_status: 'paid',
                cashfree_payment_id: payload.data.payment.cf_payment_id?.toString(),
                paid_at: new Date().toISOString()
            })
            .eq('id', payment.id)
        
        if (updateErr) {
            console.error('Error updating ride_payments:', updateErr)
        }

        // --- NEW: Update booking status to completed ---
        // This ensures the ride is marked complete even if the user closes the app
        if (payment.booking_id) {
            console.log('Marking booking completed:', payment.booking_id)
            const { error: bookingErr } = await supabaseAdmin
                .from('booking_requests')
                .update({ 
                    status: 'completed', 
                    drop_status: 'completed',
                    dropped_at: new Date().toISOString()
                })
                .eq('id', payment.booking_id)
            
            if (bookingErr) {
                console.error('Error updating booking status:', bookingErr)
            }
        }

        // Credit driver wallet
        try {
            console.log('Crediting driver wallet:', payment.driver_id, 'Amount:', payment.driver_amount)
            const { error: rpcErr } = await supabaseAdmin.rpc('add_to_wallet', {
                p_driver_user_id: payment.driver_id,
                p_amount: payment.driver_amount,
                p_ride_id: payment.trip_id,
                p_description: 'Online payment earning (after 15% commission)'
            })

            if (rpcErr) throw rpcErr;

            // Notify driver
            await supabaseAdmin.from('notifications').insert({
                user_id: payment.driver_id,
                type: 'payment_received',
                title: 'Payment Received!',
                message: `Passenger paid ₹${payment.total_amount}. Added ₹${payment.driver_amount} to your wallet.`,
                data: { trip_id: payment.trip_id, payment_id: payment.id }
            })
        } catch (walletErr) {
            console.error('Wallet credit error:', walletErr)
        }

        return new Response('Success', { status: 200 })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500 }
        )
    }
})
