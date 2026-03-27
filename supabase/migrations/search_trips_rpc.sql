-- search_trips RPC function for Supabase
-- Run this in Supabase SQL Editor

-- Drop old version first (different return type)
DROP FUNCTION IF EXISTS search_trips(text, text, date, text, integer, integer);

CREATE OR REPLACE FUNCTION search_trips(
  search_from TEXT,
  search_to TEXT,
  search_date DATE DEFAULT NULL,
  vehicle_pref TEXT DEFAULT 'any',
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  driver_name TEXT,
  driver_avatar TEXT,
  vehicle_type TEXT,
  available_seats INT,
  price_per_seat NUMERIC(10,2),
  from_location TEXT,
  to_location TEXT,
  travel_date DATE,
  travel_time TIME,
  status TEXT,
  ladies_only BOOLEAN,
  no_smoking BOOLEAN,
  pet_friendly BOOLEAN,
  distance_km NUMERIC(8,2),
  duration_min INT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    COALESCE(p.full_name, 'Driver') AS driver_name,
    p.avatar_url AS driver_avatar,
    t.vehicle_type,
    t.available_seats,
    t.price_per_seat,
    t.from_location,
    t.to_location,
    t.travel_date,
    t.travel_time,
    t.status,
    t.ladies_only,
    t.no_smoking,
    t.pet_friendly,
    t.distance_km,
    t.duration_min,
    COUNT(*) OVER() AS total_count
  FROM trips t
  LEFT JOIN profiles p ON p.id = t.user_id
  WHERE
    t.status = 'active'
    AND t.available_seats > 0
    -- Fuzzy match on from_location (case-insensitive partial match)
    AND LOWER(t.from_location) LIKE '%' || LOWER(search_from) || '%'
    -- Fuzzy match on to_location (case-insensitive partial match)
    AND LOWER(t.to_location) LIKE '%' || LOWER(search_to) || '%'
    -- Optional date filter
    AND (search_date IS NULL OR t.travel_date = search_date)
    -- Optional vehicle type filter
    AND (vehicle_pref = 'any' OR t.vehicle_type = vehicle_pref)
  ORDER BY t.travel_date ASC, t.travel_time ASC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;
