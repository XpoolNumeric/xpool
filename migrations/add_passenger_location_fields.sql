-- Add passenger pickup and destination fields to booking_requests
-- Run this in Supabase SQL Editor

ALTER TABLE public.booking_requests
ADD COLUMN IF NOT EXISTS passenger_location text NULL,
ADD COLUMN IF NOT EXISTS passenger_destination text NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN public.booking_requests.passenger_location IS 'Passenger pickup point';
COMMENT ON COLUMN public.booking_requests.passenger_destination IS 'Passenger drop-off destination';
