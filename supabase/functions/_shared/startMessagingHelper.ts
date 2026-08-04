// Start Messaging OTP Helper
const START_MESSAGING_BASE_URL = 'https://api.startmessaging.com'
const DEFAULT_TEMPLATE_ID = '0afbdeb0-785d-4dd0-bd48-365a182df276'

export interface StartMessagingSendOtpOptions {
    phoneNumber: string // Must be in E.164 format, e.g. +919876543210
    otp: string        // 4-6 digit OTP code
    appName?: string   // App name variable e.g. "XPool"
    templateId?: string
}

export interface StartMessagingResponse {
    success: boolean
    message: string
    data?: any
}

/**
 * Normalises phone number to standard E.164 format (+91XXXXXXXXXX)
 */
export function normaliseE164Phone(phone: string): string {
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

/**
 * Validates whether a string is a valid E.164 phone number
 */
export function isValidE164Phone(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{9,14}$/
    return e164Regex.test(phone)
}

export function getStartMessagingApiKey(): string {
    return Deno.env.get('START_MESSAGING_API_KEY') ||
        Deno.env.get('STARTMESSAGING_API_KEY') ||
        Deno.env.get('START_MESSAGING_KEY') ||
        ''
}

/**
 * Sends OTP via Start Messaging API
 */
export async function sendStartMessagingOtp(
    options: StartMessagingSendOtpOptions
): Promise<StartMessagingResponse> {
    const apiKey = getStartMessagingApiKey()
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

        if (res.ok && (data.success || data.status === 'success' || data.message || res.status === 200)) {
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
