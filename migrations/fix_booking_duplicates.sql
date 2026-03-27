
-- 1. Identify duplicates and delete them, keeping the "best" one
-- Logic: Prefer 'approved' requests. If multiple approved or none, prefer the latest created one.
WITH duplicates AS (
  SELECT
    id,
    trip_id,
    passenger_id,
    status,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id, passenger_id
      ORDER BY
        CASE WHEN status = 'approved' THEN 1 ELSE 2 END ASC, -- Prefer approved first (lower number is better)
        created_at DESC -- Then prefer latest
    ) as rn
  FROM
    public.booking_requests
)
DELETE FROM public.booking_requests
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE public.booking_requests
ADD CONSTRAINT booking_requests_trip_id_passenger_id_key UNIQUE (trip_id, passenger_id);
