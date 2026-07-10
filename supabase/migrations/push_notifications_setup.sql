-- ========================================================
-- Firebase Push Notifications Setup
-- Run this in your Supabase SQL Editor
-- ========================================================

-- === 1. Create user_fcm_tokens Table ===
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    fcm_token TEXT UNIQUE NOT NULL,
    device_type VARCHAR(20) DEFAULT 'android',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- === 2. Create Performance Index ===
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON user_fcm_tokens(user_id);

-- === 3. Enable Row Level Security (RLS) ===
ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- === 4. Define RLS Policies ===

-- Allow users to view their own registration tokens
CREATE POLICY "Users can view their own FCM tokens" ON user_fcm_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own registration tokens
CREATE POLICY "Users can insert their own FCM tokens" ON user_fcm_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own registration tokens
CREATE POLICY "Users can update their own FCM tokens" ON user_fcm_tokens
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own registration tokens
CREATE POLICY "Users can delete their own FCM tokens" ON user_fcm_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Allow service_role key to manage all tokens (needed for cleaning up stale tokens in Edge Functions)
CREATE POLICY "Service role can manage all FCM tokens" ON user_fcm_tokens
    FOR ALL USING (true) WITH CHECK (true);

-- === 5. Setup Webhook Trigger on notifications Table (Optional: Recommended to do via Dashboard Webhooks) ===
-- Alternatively, you can configure this Webhook in the Supabase Dashboard:
-- Database -> Webhooks -> Create Webhook:
--   Name: send_push_notification
--   Table: notifications
--   Events: Insert
--   Action: Send HTTP Request
--   HTTP Method: POST
--   URL: https://<your-project-id>.supabase.co/functions/v1/send-push-notification
--   Headers: Authorization: Bearer <your-anon-key>
