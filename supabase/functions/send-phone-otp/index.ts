import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-startmessaging-key',
}

// ── Start Messaging OTP Helpers ──────────────────────────────────────────────
const START_MESSAGING_BASE_URL = 'https://api.startmessaging.com'
const DEFAULT_TEMPLATE_ID = '0afbdeb0-785d-4dd0-bd48-365a182df276'

function normaliseE164Phone(phone: string): string {
    if (!phone) return ''
    let cleaned = phone.trim().replace(/[^\d+]/g, '')
    if (!cleaned.startsWith('+')) {
        const digits = cleaned.replace(/\D/g, '')
        if (digits.length === 10) {
            cleaned = `+91${digits}`
        } else {
            cleaned = `+${digits}`
        }
    }
    return cleaned
}

function isValidE164Phone(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{9,14}$/
    return e164Regex.test(phone)
}

function getStartMessagingApiKey(reqHeader?: string | null, bodyKey?: string | null): string {
    return (bodyKey && bodyKey.trim()) ||
        (reqHeader && reqHeader.trim()) ||
        Deno.env.get('START_MESSAGING_API_KEY') ||
        Deno.env.get('STARTMESSAGING_API_KEY') ||
        Deno.env.get('START_MESSAGING_KEY') ||
        ''
}

async function sendStartMessagingOtp(options: {
    phoneNumber: string
    otp: string
    apiKeyOverride?: string
    appName?: string
    templateId?: string
}): Promise<{ success: boolean; message: string; data?: any }> {
    const apiKey = options.apiKeyOverride || getStartMessagingApiKey()
    const templateId = options.templateId || Deno.env.get('START_MESSAGING_TEMPLATE_ID') || DEFAULT_TEMPLATE_ID
    const appName = options.appName || Deno.env.get('APP_NAME') || 'XPool'

    if (!apiKey) {
        console.error('[StartMessaging] Missing START_MESSAGING_API_KEY environment variable in Supabase Secrets')
        return {
            success: false,
            message: 'START_MESSAGING_API_KEY secret is not set in Supabase. Please configure START_MESSAGING_API_KEY in Supabase Edge Function Secrets.'
        }
    }

    const phoneNumber = normaliseE164Phone(options.phoneNumber)
    if (!isValidE164Phone(phoneNumber)) {
        console.error('[StartMessaging] Invalid phone number format:', options.phoneNumber, '->', phoneNumber)
        return { success: false, message: 'Invalid phone number format. Please provide a valid 10-digit mobile number.' }
    }

    const payload = {
        phoneNumber,
        templateId,
        variables: {
            otp: options.otp,
            appName
        }
    }

    try {
        console.log(`[StartMessaging] Sending OTP to ${phoneNumber} with templateId ${templateId}`)
        const res = await fetch(`${START_MESSAGING_BASE_URL}/otp/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify(payload)
        })

        const data = await res.json().catch(() => ({}))
        console.log('[StartMessaging] Response:', JSON.stringify(data))

        if (res.ok || data.success || data.status === 'success' || data.message || data.id) {
            return {
                success: true,
                message: data.message || 'OTP sent successfully via Start Messaging',
                data
            }
        }

        const errorMsg = data.message || data.error || `Start Messaging API error (${res.status})`
        console.error(`[StartMessaging] Failed to send OTP (${res.status}):`, data)
        return {
            success: false,
            message: errorMsg,
            data
        }
    } catch (err: any) {
        console.error('[StartMessaging] Fetch error:', err)
        return {
            success: false,
            message: err?.message || 'Network error communicating with Start Messaging API'
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        console.log('[send-phone-otp] Received payload:', JSON.stringify(body))

        const reqApiKey = req.headers.get('x-startmessaging-key') || body.apiKey || null
        const apiKey = getStartMessagingApiKey(reqApiKey, body.apiKey)

        // ── 0. Pre-validate API Key Configuration ────────────────────────────────
        if (!apiKey) {
            const secretErr = 'START_MESSAGING_API_KEY secret is missing in Supabase Edge Function Secrets. Please set START_MESSAGING_API_KEY in your Supabase Dashboard Edge Function Secrets.'
            console.error('[send-phone-otp] Config Error:', secretErr)
            return new Response(
                JSON.stringify({ error: secretErr }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── 1. Check if called as a Supabase Auth SMS Hook ──────────────────────
        if (body.user && body.sms && body.sms.otp) {
            const rawPhone = body.user.phone || ''
            const otp = body.sms.otp

            if (!rawPhone) {
                return new Response(
                    JSON.stringify({ error: 'Phone number not found in hook payload' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const mobile = normaliseE164Phone(rawPhone)
            console.log(`[send-phone-otp] Routing Supabase SMS Hook OTP for ${mobile} via Start Messaging...`)

            const result = await sendStartMessagingOtp({ phoneNumber: mobile, otp, apiKeyOverride: apiKey })
            if (!result.success) {
                console.error('[send-phone-otp] Start Messaging SMS Hook send failed for:', mobile, result.message)
                return new Response(
                    JSON.stringify({ error: result.message }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({ success: true, message: 'OTP sent via Start Messaging Hook' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── 2. Direct / manual API call flow ─────────────────────────────────────
        const { phone } = body
        if (!phone) {
            return new Response(
                JSON.stringify({ error: 'Phone number is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const mobile = normaliseE164Phone(phone)
        if (!isValidE164Phone(mobile)) {
            return new Response(
                JSON.stringify({ error: 'Please enter a valid 10-digit mobile number' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Admin client — service role bypasses RLS on phone_otps
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2a. Check rate limits (prevent duplicate requests within 30s)
        const { data: existingRecord } = await supabaseAdmin
            .from('phone_otps')
            .select('updated_at, created_at')
            .eq('phone', mobile)
            .maybeSingle()

        if (existingRecord) {
            const lastUpdated = new Date(existingRecord.updated_at || existingRecord.created_at).getTime()
            const timeSinceLastOtpSec = (Date.now() - lastUpdated) / 1000

            if (timeSinceLastOtpSec < 30) {
                const waitSec = Math.ceil(30 - timeSinceLastOtpSec)
                console.warn(`[send-phone-otp] Rate limit hit for ${mobile}. Wait time: ${waitSec}s`)
                return new Response(
                    JSON.stringify({ error: `Please wait ${waitSec} second(s) before requesting a new OTP.` }),
                    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 2b. Generate 6-digit OTP code & 5-minute expiry
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        // 2c. Dispatch OTP via Start Messaging API FIRST
        const result = await sendStartMessagingOtp({ phoneNumber: mobile, otp, apiKeyOverride: apiKey })
        if (!result.success) {
            console.error('[send-phone-otp] Start Messaging send failed for:', mobile, result.message)
            return new Response(
                JSON.stringify({ error: result.message || 'Failed to send OTP message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2d. Record OTP in DB ONLY after successful send to prevent rate limit lock on failure
        const { error: upsertError } = await supabaseAdmin
            .from('phone_otps')
            .upsert(
                {
                    phone: mobile,
                    otp_code: otp,
                    expires_at: expiresAt,
                    attempts: 0,
                    verified: false,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'phone' }
            )

        if (upsertError) {
            console.error('[send-phone-otp] DB upsert error:', upsertError)
        }

        console.log(`[send-phone-otp] OTP successfully dispatched to ${mobile} via Start Messaging`)
        return new Response(
            JSON.stringify({ success: true, message: 'OTP sent successfully to your mobile number' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[send-phone-otp] Exception:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
