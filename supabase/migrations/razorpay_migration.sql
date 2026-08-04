-- =============================================
-- Migration: Add Razorpay tracking columns to ride_payments and wallet_recharges
-- Run this in your Supabase SQL Editor
-- =============================================

ALTER TABLE ride_payments 
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

ALTER TABLE wallet_recharges 
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

-- Create indexes for fast lookup on razorpay order & payment IDs
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON ride_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_recharges_razorpay_order ON wallet_recharges(razorpay_order_id);
