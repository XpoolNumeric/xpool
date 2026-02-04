create table public.booking_requests (
  id uuid not null default gen_random_uuid (),
  trip_id uuid null,
  passenger_id uuid null,
  seats_requested integer not null default 1,
  status text null default 'pending'::text,
  payment_mode text null,
  payment_status text null default 'pending'::text,
  message text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  driver_id uuid null,
  constraint booking_requests_pkey primary key (id),
  constraint booking_requests_passenger_id_fkey foreign KEY (passenger_id) references auth.users (id) on delete CASCADE,
  constraint booking_requests_trip_id_fkey foreign KEY (trip_id) references trips (id) on delete CASCADE,
  constraint booking_requests_driver_id_fkey foreign KEY (driver_id) references auth.users (id) on delete set null,
  constraint booking_requests_payment_status_check check (
    (
      payment_status = any (
        array['pending'::text, 'paid'::text, 'failed'::text]
      )
    )
  ),
  constraint booking_requests_payment_mode_check check (
    (
      payment_mode = any (array['online'::text, 'cod'::text])
    )
  ),
  constraint booking_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text,
          'cancelled'::text,
          'in_progress'::text,
          'completed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_booking_requests_passenger_id on public.booking_requests using btree (passenger_id) TABLESPACE pg_default;

create index IF not exists idx_booking_requests_driver_id on public.booking_requests using btree (driver_id) TABLESPACE pg_default;

create trigger on_booking_request_created
after INSERT on booking_requests for EACH row
execute FUNCTION handle_new_booking_request ();
