-- Migration: Change auto-cancel to auto-expire
-- Updates expired trips to 'expired' status instead of 'cancelled'
-- An expired trip = past date + active status + no approved passengers

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_trips(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark trips as 'expired' when:
  -- 1) Travel date has passed (before today)
  -- 2) Trip is still 'active'
  -- 3) Has zero approved bookings (no passengers)
  UPDATE public.trips
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND travel_date < CURRENT_DATE
    AND status = 'active'
    AND NOT EXISTS (
      SELECT 1 
      FROM public.booking_requests br 
      WHERE br.trip_id = trips.id 
        AND br.status = 'approved'
    );
END;
$$;
