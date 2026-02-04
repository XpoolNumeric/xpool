create table public.trips (
  id uuid not null default gen_random_uuid (),
  driver_id uuid null,
  user_id uuid null,
  vehicle_type text not null,
  available_seats integer not null default 1,
  price_per_seat numeric(10, 2) not null,
  from_location text not null,
  to_location text not null,
  travel_date date not null,
  travel_time time without time zone not null,
  status text null default 'active'::text,
  otp_code text null,
  ladies_only boolean null default false,
  no_smoking boolean null default false,
  pet_friendly boolean null default false,
  is_recurring boolean null default false,
  recurring_pattern text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint trips_pkey primary key (id),
  constraint trips_driver_id_fkey foreign KEY (driver_id) references drivers (id) on delete CASCADE,
  constraint trips_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint trips_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'full'::text,
          'in_progress'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    )
  ),
  constraint trips_vehicle_type_check check (
    (
      vehicle_type = any (array['car'::text, 'bike'::text])
    )
  )
) TABLESPACE pg_default;

create trigger on_trip_completed
after
update on trips for EACH row
execute FUNCTION handle_trip_completion ();
