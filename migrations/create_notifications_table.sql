-- Notifications table for in-app notifications
-- Run this in Supabase SQL Editor if the table doesn't already exist

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  reference_id text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id) TABLESPACE pg_default;

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications USING btree (user_id, read) WHERE read = false;

-- Enable Realtime on this table (run in Supabase SQL Editor)
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
