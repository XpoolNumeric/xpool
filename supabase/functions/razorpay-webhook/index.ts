import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

serve(async (req: Request) => {
    try {
        const bodyText = await req.text()
        const payload = JSON.parse(bodyText)

        console.log('[Razorpay Webhook] Event:', payload.event)

        if (payload.event !== 'payment.captured' && payload.event !== 'order.paid') {
            return new Response('Ignored event', { status: 200 })
        }

        const paymentEntity = payload.payload?.payment?.entity
        const orderEntity = payload.payload?.order?.entity

        const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id
        const razorpayPaymentId = paymentEntity?.id

        if (!razorpayOrderId) {
            return new Response('Missing order ID in webhook payload', { status: 400 })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Check Driver Wallet Recharges
        const { data: recharge } = await supabaseAdmin
            .from('wallet_recharges')
            .select('*')
            .eq('razorpay_order_id', razorpayOrderId)
            .maybeSingle()

        if (recharge) {
            if (recharge.status !== 'paid') {
                await supabaseAdmin
                    .from('wallet_recharges')
                    .update({
                        status: 'paid',
                        razorpay_payment_id: razorpayPaymentId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', recharge.id)

                const { data: driver } = await supabaseAdmin
                    .from('drivers')
                    .select('user_id')
                    .eq('id', recharge.driver_id)
                    .single()

                if (driver) {
                    await supabaseAdmin.rpc('add_to_wallet', {
                        p_driver_user_id: driver.user_id,
                        p_amount: recharge.amount,
                        p_ride_id: recharge.id,
                        p_description: 'Wallet Top-up Complete (Webhook)'
                    })

                    await supabaseAdmin.from('notifications').insert({
                        user_id: driver.user_id,
                        type: 'wallet_recharge',
                        title: 'Funds Added!',
                        message: `Successfully added ₹${recharge.amount} to your wallet.`,
                        data: { recharge_id: recharge.id }
                    })
                }
            }

            return new Response('Recharge processed successfully', { status: 200 })
        }

        // 2. Check Ride Payments
        const { data: payment } = await supabaseAdmin
            .from('ride_payments')
            .select('*')
            .eq('razorpay_order_id', razorpayOrderId)
            .maybeSingle()

        if (payment) {
            if (payment.payment_status !== 'paid') {
                await supabaseAdmin
                    .from('ride_payments')
                    .update({
                        payment_status: 'paid',
                        razorpay_payment_id: razorpayPaymentId,
                        paid_at: new Date().toISOString()
                    })
                    .eq('id', payment.id)

                if (payment.booking_id) {
                    await supabaseAdmin
                        .from('booking_requests')
                        .update({ status: 'completed', drop_status: 'completed' })
                        .eq('id', payment.booking_id)
                }

                await supabaseAdmin.rpc('add_to_wallet', {
                    p_driver_user_id: payment.driver_id,
                    p_amount: payment.driver_amount,
                    p_ride_id: payment.trip_id,
                    p_description: 'Online payment earning (after 15% commission)'
                })

                await supabaseAdmin.from('notifications').insert({
                    user_id: payment.driver_id,
                    type: 'payment_received',
                    title: 'Payment Received!',
                    message: `Passenger paid ₹${payment.total_amount}. Added ₹${payment.driver_amount} to your wallet.`,
                    data: { trip_id: payment.trip_id, payment_id: payment.id }
                })
            }

            return new Response('Payment processed successfully', { status: 200 })
        }

        return new Response('No matching payment record found', { status: 404 })

    } catch (err: any) {
        console.error('[Razorpay Webhook] Error:', err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
