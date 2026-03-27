  -- =============================================
  -- Phase 3: Ride Start → Tracking → Payment
  -- Run this in your Supabase SQL Editor
  -- =============================================

  -- === 1. booking_requests: per-passenger tracking columns ===
  ALTER TABLE booking_requests 
    ADD COLUMN IF NOT EXISTS otp_code VARCHAR(4),
    ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS drop_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS pickup_order INTEGER,
    ADD COLUMN IF NOT EXISTS dropped_at TIMESTAMPTZ;

  -- === 2. trips: live tracking + timestamps ===
  ALTER TABLE trips 
    ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

  -- === 3. ride_payments: payment ledger per passenger ===
  CREATE TABLE IF NOT EXISTS ride_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES booking_requests(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    driver_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    cashfree_order_id VARCHAR(100),
    cashfree_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    UNIQUE(trip_id, passenger_id)
  );

  -- === 4. Performance indexes ===
  CREATE INDEX IF NOT EXISTS idx_br_drop_status ON booking_requests(drop_status);
  CREATE INDEX IF NOT EXISTS idx_br_otp_code ON booking_requests(otp_code);
  CREATE INDEX IF NOT EXISTS idx_payments_trip ON ride_payments(trip_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON ride_payments(payment_status);
  CREATE INDEX IF NOT EXISTS idx_trips_status_v2 ON trips(status);

  -- === 5. Wallet RPC: atomic credit to driver wallet ===
  CREATE OR REPLACE FUNCTION add_to_wallet(
    p_driver_user_id UUID,
    p_amount DECIMAL,
    p_ride_id UUID,
    p_description TEXT DEFAULT 'Ride earning (after 15% commission)'
  ) RETURNS VOID AS $$
  DECLARE 
    v_driver_id UUID;
    v_wallet_id UUID;
  BEGIN
    -- Look up driver record from user_id
    SELECT id INTO v_driver_id 
    FROM drivers 
    WHERE user_id = p_driver_user_id 
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      RAISE EXCEPTION 'Driver not found for user %', p_driver_user_id;
    END IF;

    -- Get or create wallet
    SELECT id INTO v_wallet_id 
    FROM driver_wallets 
    WHERE driver_id = v_driver_id;

    IF v_wallet_id IS NULL THEN
      INSERT INTO driver_wallets (driver_id, balance)
      VALUES (v_driver_id, p_amount)
      RETURNING id INTO v_wallet_id;
    ELSE
      UPDATE driver_wallets 
      SET balance = balance + p_amount, last_updated = NOW() 
      WHERE id = v_wallet_id;
    END IF;

    -- Record transaction
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (v_wallet_id, p_amount, 'credit', p_description, p_ride_id::text);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- === 6. RLS policies for ride_payments ===
  ALTER TABLE ride_payments ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view their own payments" ON ride_payments
    FOR SELECT USING (
      passenger_id = auth.uid() OR driver_id = auth.uid()
    );

  CREATE POLICY "Service role can manage payments" ON ride_payments
    FOR ALL USING (true) WITH CHECK (true);
