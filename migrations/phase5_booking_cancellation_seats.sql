-- Migration: Recalculate trip available seats when a booking request is cancelled or deleted
-- This ensures that passenger cancellations return seats to the pool and mark 'full' trips as 'active' again.

CREATE OR REPLACE FUNCTION public.handle_booking_cancellation_or_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle UPDATE where status changes from approved to cancelled/rejected/pending
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'in_progress', 'completed')) THEN
      UPDATE public.trips
      SET 
        available_seats = available_seats + OLD.seats_requested,
        status = CASE 
          WHEN status = 'full' THEN 'active'
          ELSE status
        END
      WHERE id = OLD.trip_id;
    END IF;
  -- Handle DELETE where an approved booking is removed
  ELSIF (TG_OP = 'DELETE') THEN
    IF (OLD.status = 'approved') THEN
      UPDATE public.trips
      SET 
        available_seats = available_seats + OLD.seats_requested,
        status = CASE 
          WHEN status = 'full' THEN 'active'
          ELSE status
        END
      WHERE id = OLD.trip_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicate error
DROP TRIGGER IF EXISTS on_booking_cancelled_or_deleted ON public.booking_requests;

CREATE TRIGGER on_booking_cancelled_or_deleted
AFTER UPDATE OR DELETE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_cancellation_or_deletion();
