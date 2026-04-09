import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id } = await req.json()
    if (!order_id) throw new Error('Missing order_id')

    const appId = (Deno.env.get('CASHFREE_APP_ID') || '').trim()
    const secretKey = (Deno.env.get('CASHFREE_SECRET_KEY') || '').trim()
    const env = (Deno.env.get('CASHFREE_ENV') || 'PRODUCTION').trim()

    if (!appId || !secretKey) throw new Error('Cashfree keys not configured')

    const baseUrl = env === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'

    console.log(`Verifying order ${order_id} via Cashfree API...`)

    // 1. Fetch order status from Cashfree
    const response = await fetch(`${baseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'Content-Type': 'application/json'
      }
    })

    const cashfreeData = await response.json()
    
    if (!response.ok) {
      console.error('Cashfree API error:', cashfreeData)
      throw new Error(cashfreeData.message || 'Payment gateway error')
    }

    const isPaid = cashfreeData.order_status === 'PAID'
    console.log(`Cashfree status for ${order_id}: ${cashfreeData.order_status}`)

    // 2. If PAID, sync with local DB
    if (isPaid) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Get payment record first
      const { data: payment } = await supabaseAdmin
        .from('ride_payments')
        .select('*')
        .eq('cashfree_order_id', order_id)
        .maybeSingle()

      if (payment && payment.payment_status !== 'paid') {
        console.log(`Syncing payment ${payment.id} as PAID...`)
        
        // Update payment status
        await supabaseAdmin
          .from('ride_payments')
          .update({
            payment_status: 'paid',
            cashfree_payment_id: cashfreeData.cf_order_id?.toString() || order_id,
            paid_at: new Date().toISOString()
          })
          .eq('id', payment.id)

        // Update booking status
        if (payment.booking_id) {
          await supabaseAdmin
            .from('booking_requests')
            .update({ 
               status: 'completed', 
               drop_status: 'completed',
               dropped_at: new Date().toISOString()
            })
            .eq('id', payment.booking_id)
        }

        // Credit driver wallet
        try {
          await supabaseAdmin.rpc('add_to_wallet', {
            p_driver_user_id: payment.driver_id,
            p_amount: payment.driver_amount,
            p_ride_id: payment.trip_id,
            p_description: 'Online payment earning (Force Verified)'
          })
        } catch (walletErr) {
          console.error('Wallet credit error:', walletErr)
        }
      } else if (!payment) {
          console.warn(`No payment record found for order ${order_id}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: cashfreeData.order_status, 
        is_paid: isPaid 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    const error = err as Error
    console.error('Verification Function Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
