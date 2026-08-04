-- Migration: Create phone_otps table for Start Messaging OTP lifecycle management
-- Run this SQL in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.phone_otps (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    phone         text        NOT NULL,                          -- normalised: "91XXXXXXXXXX"
    otp_code      text        NOT NULL,
    expires_at    timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    attempts      int         NOT NULL DEFAULT 0,
    verified      boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT NOW(),
    updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- Unique index: one active OTP per phone at a time
CREATE UNIQUE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps (phone);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_phone_otps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phone_otps_updated_at ON public.phone_otps;
CREATE TRIGGER trg_phone_otps_updated_at
    BEFORE UPDATE ON public.phone_otps
    FOR EACH ROW EXECUTE FUNCTION public.update_phone_otps_updated_at();

-- Enable RLS — public cannot read OTPs; only service-role (edge functions) can
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "No public access" ON public.phone_otps;
CREATE POLICY "No public access"
    ON public.phone_otps FOR ALL
    USING (false);
