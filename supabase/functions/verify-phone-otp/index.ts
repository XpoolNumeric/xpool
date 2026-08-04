import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Phone Normalisation Helpers ──────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        console.log('[verify-phone-otp] Received request:', JSON.stringify(body))

        const phoneInput = body.phone
        const otpInput = body.otp ? String(body.otp).trim() : ''
        const isAddMode = Boolean(body.isAddMode || body.type === 'phone_change')

        if (!phoneInput) {
            return new Response(
                JSON.stringify({ error: 'Phone number is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!otpInput || otpInput.length !== 6 || !/^\d+$/.test(otpInput)) {
            return new Response(
                JSON.stringify({ error: 'Please enter a valid 6-digit OTP code' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const verifiedMobile = normaliseE164Phone(phoneInput)
        if (!isValidE164Phone(verifiedMobile)) {
            return new Response(
                JSON.stringify({ error: 'Invalid phone number format' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Admin client to manage DB & users
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ── 1. Fetch OTP record from phone_otps table ────────────────────────────
        const { data: record, error: fetchError } = await supabaseAdmin
            .from('phone_otps')
            .select('otp_code, expires_at, attempts, verified')
            .eq('phone', verifiedMobile)
            .maybeSingle()

        if (fetchError) {
            console.error('[verify-phone-otp] DB error fetching OTP record:', fetchError)
            return new Response(
                JSON.stringify({ error: 'Database error verifying OTP' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!record) {
            console.warn('[verify-phone-otp] No OTP record found for:', verifiedMobile)
            return new Response(
                JSON.stringify({ error: 'No OTP requested for this phone number. Please request a new OTP.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check 1: Maximum attempts (limit 5)
        if (record.attempts >= 5) {
            console.warn(`[verify-phone-otp] Attempt limit exceeded for ${verifiedMobile}`)
            return new Response(
                JSON.stringify({ error: 'Maximum OTP verification attempts reached. Please request a new OTP.' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check 2: Expiration check
        const expiresAtDate = new Date(record.expires_at)
        if (new Date() > expiresAtDate) {
            console.warn(`[verify-phone-otp] Expired OTP code presented for ${verifiedMobile}`)
            return new Response(
                JSON.stringify({ error: 'OTP has expired. Please request a new OTP.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check 3: Code equality
        if (record.otp_code !== otpInput) {
            const nextAttempts = (record.attempts || 0) + 1
            await supabaseAdmin
                .from('phone_otps')
                .update({ attempts: nextAttempts })
                .eq('phone', verifiedMobile)

            const remainingAttempts = Math.max(0, 5 - nextAttempts)
            console.warn(`[verify-phone-otp] Mismatched OTP for ${verifiedMobile}. Attempts used: ${nextAttempts}`)
            return new Response(
                JSON.stringify({
                    error: remainingAttempts > 0
                        ? `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`
                        : 'Invalid OTP code. Maximum attempts reached. Please request a new OTP.'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Code matches! Mark as verified
        await supabaseAdmin
            .from('phone_otps')
            .update({ verified: true, attempts: (record.attempts || 0) + 1 })
            .eq('phone', verifiedMobile)

        console.log(`[verify-phone-otp] OTP successfully verified for: ${verifiedMobile}`)

        // ── 2. Add Phone Mode (Explicit Phone Link to Active Logged-In User) ──────
        const authHeader = req.headers.get('Authorization')
        if (isAddMode && authHeader) {
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            )
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

            if (user && !userError) {
                console.log(`[verify-phone-otp] Linking phone to active user ${user.id}...`)
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    user.id,
                    { phone: verifiedMobile, phone_confirm: true }
                )
                if (updateError) {
                    console.error('[verify-phone-otp] Error updating user phone:', updateError)
                    return new Response(
                        JSON.stringify({ error: updateError.message || 'Failed to link phone number' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                await supabaseAdmin
                    .from('profiles')
                    .update({ phone: verifiedMobile })
                    .eq('id', user.id)

                return new Response(
                    JSON.stringify({ success: true, message: 'Phone number linked and verified successfully' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // ── 3. Standard Login / Registration Flow: Existing vs New User ──────────
        console.log(`[verify-phone-otp] Resolving user account for phone: ${verifiedMobile}`)

        const digitsOnly = verifiedMobile.replace(/\D/g, '') // e.g. 919361409536
        const raw10Digits = digitsOnly.slice(-10) // e.g. 9361409536
        const formattedWithPlus = `+${digitsOnly}` // e.g. +919361409536

        let existingUser: any = null

        // 3a. Search auth.users — separate queries to avoid + sign breaking .or() filter
        const { data: byE164 } = await supabaseAdmin
            .schema('auth')
            .from('users')
            .select('id, phone, email')
            .eq('phone', formattedWithPlus)
            .maybeSingle()
        existingUser = byE164 || null

        if (!existingUser) {
            const { data: byDigits } = await supabaseAdmin
                .schema('auth')
                .from('users')
                .select('id, phone, email')
                .eq('phone', digitsOnly)
                .maybeSingle()
            existingUser = byDigits || null
        }

        if (!existingUser) {
            const { data: by10Digits } = await supabaseAdmin
                .schema('auth')
                .from('users')
                .select('id, phone, email')
                .eq('phone', raw10Digits)
                .maybeSingle()
            existingUser = by10Digits || null
        }

        // 3b. Fallback: Search profiles table by phone (separate queries)
        if (!existingUser) {
            const phoneVariants = [formattedWithPlus, digitsOnly, raw10Digits]
            for (const variant of phoneVariants) {
                const { data: profileRecord } = await supabaseAdmin
                    .from('profiles')
                    .select('id, phone')
                    .eq('phone', variant)
                    .maybeSingle()
                if (profileRecord?.id) {
                    const { data: authUserFromProfile } = await supabaseAdmin.auth.admin.getUserById(profileRecord.id)
                    if (authUserFromProfile?.user) {
                        existingUser = authUserFromProfile.user
                        break
                    }
                }
            }
        }

        console.log(`[verify-phone-otp] User lookup result: ${existingUser ? 'FOUND id=' + existingUser.id : 'NOT FOUND'}`)

        const tempPassword = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
        let userId = ''
        let isNewUser = false

        if (existingUser) {
            console.log(`[verify-phone-otp] Found EXISTING registered user: ${existingUser.id}`)
            userId = existingUser.id
            isNewUser = false

            // Only update password — never touch the phone field to avoid "already registered" error
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                {
                    password: tempPassword,
                    phone_confirm: true
                }
            )
            if (updateError) {
                console.error('[verify-phone-otp] Error updating existing user password:', updateError)
                throw new Error('Failed to update credentials for existing user: ' + updateError.message)
            }
        } else {
            console.log(`[verify-phone-otp] NO existing user found. Registering NEW user for: ${formattedWithPlus}`)
            isNewUser = true
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                phone: formattedWithPlus,
                phone_confirm: true,
                password: tempPassword,
                user_metadata: { role: 'passenger' }
            })

            if (createError || !newUser?.user) {
                console.error('[verify-phone-otp] Error creating new user:', createError)

                // ── Graceful fallback: "Phone already registered" race condition ────────
                // This happens when the phone exists in auth.users but our lookup queries missed it
                // (e.g. phone stored in a different format). Try listing users to find the match.
                const looksLikeDuplicate = createError?.message?.toLowerCase().includes('already') ||
                    createError?.message?.toLowerCase().includes('registered') ||
                    createError?.message?.toLowerCase().includes('duplicate') ||
                    createError?.message?.toLowerCase().includes('unique')

                if (looksLikeDuplicate) {
                    console.log('[verify-phone-otp] Duplicate phone detected on create. Searching for existing user via listUsers...')
                    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
                    const matchedUser = allUsers?.users?.find(u => {
                        const uPhone = (u.phone || '').replace(/\D/g, '')
                        const targetPhone = formattedWithPlus.replace(/\D/g, '')
                        return uPhone && (uPhone === targetPhone || uPhone.slice(-10) === targetPhone.slice(-10))
                    })

                    if (matchedUser) {
                        console.log(`[verify-phone-otp] Found existing user via listUsers: ${matchedUser.id}. Treating as login.`)
                        existingUser = matchedUser
                        isNewUser = false
                        userId = matchedUser.id

                        // Update password on existing user so we can sign them in
                        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                            matchedUser.id,
                            { password: tempPassword, phone_confirm: true }
                        )
                        if (updateError) {
                            console.error('[verify-phone-otp] Error updating existing user password (fallback):', updateError)
                            throw new Error('Failed to authenticate existing user: ' + updateError.message)
                        }
                    } else {
                        console.error('[verify-phone-otp] Could not find existing user via listUsers fallback')
                        throw new Error(createError?.message || 'Failed to create new user account')
                    }
                } else {
                    throw new Error(createError?.message || 'Failed to create new user account')
                }
            } else {
                userId = newUser.user.id
            }
        }

        // Programmatically sign in user using temporary password to generate standard GoTrue session
        const supabaseAnon = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        let sessionData: any = null
        let signInError: any = null

        // Try phone sign-in first
        const phoneSignIn = await supabaseAnon.auth.signInWithPassword({
            phone: formattedWithPlus,
            password: tempPassword
        })

        if (phoneSignIn.data?.session) {
            sessionData = phoneSignIn.data
        } else {
            signInError = phoneSignIn.error
            console.warn(`[verify-phone-otp] Phone sign-in failed: ${signInError?.message}`)

            // Fallback: Try email sign-in if existing user has email
            if (existingUser?.email) {
                console.log(`[verify-phone-otp] Trying email sign-in for: ${existingUser.email}`)
                const emailSignIn = await supabaseAnon.auth.signInWithPassword({
                    email: existingUser.email,
                    password: tempPassword
                })
                if (emailSignIn.data?.session) {
                    sessionData = emailSignIn.data
                    signInError = null
                } else {
                    signInError = emailSignIn.error
                }
            }
        }

        if (!sessionData?.session) {
            console.error('[verify-phone-otp] All sign-in attempts failed:', signInError)
            return new Response(
                JSON.stringify({ error: signInError?.message || 'Failed to establish auth session' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[verify-phone-otp] Auth session successfully generated for ${isNewUser ? 'NEW' : 'EXISTING'} user: ${userId}`)
        return new Response(
            JSON.stringify({
                success: true,
                isNewUser,
                message: isNewUser ? 'User registered successfully' : 'Existing user authenticated successfully',
                session: sessionData.session
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[verify-phone-otp] Exception:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

