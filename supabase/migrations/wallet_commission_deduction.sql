  -- =============================================
  -- Phase 4: Driver Wallet Deductions & Suspension
  -- Run this in your Supabase SQL Editor
  -- =============================================

  -- === 1. Wallet Deduction RPC ===
  CREATE OR REPLACE FUNCTION deduct_commission_and_check_wallet(
    p_driver_user_id UUID,
    p_amount DECIMAL,
    p_ride_id UUID,
    p_description TEXT DEFAULT 'Commission Deducted for Cash Trip'
  ) RETURNS JSON AS $$
  DECLARE 
    v_driver_id UUID;
    v_wallet_id UUID;
    v_new_balance DECIMAL;
    v_is_suspended BOOLEAN := FALSE;
  BEGIN
    -- Look up driver record from auth user_id
    SELECT id INTO v_driver_id 
    FROM drivers 
    WHERE user_id = p_driver_user_id 
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      RAISE EXCEPTION 'Driver not found for user %', p_driver_user_id;
    END IF;

    -- Get or create wallet
    SELECT id, balance INTO v_wallet_id, v_new_balance
    FROM driver_wallets 
    WHERE driver_id = v_driver_id;

    IF v_wallet_id IS NULL THEN
      -- If they didn't have a wallet, start at 0 minus amount
      INSERT INTO driver_wallets (driver_id, balance)
      VALUES (v_driver_id, -p_amount)
      RETURNING id, balance INTO v_wallet_id, v_new_balance;
    ELSE
      -- Deduct amount
      UPDATE driver_wallets 
      SET balance = balance - p_amount, last_updated = NOW() 
      WHERE id = v_wallet_id
      RETURNING balance INTO v_new_balance;
    END IF;

    -- Record Debit transaction
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (v_wallet_id, p_amount, 'debit', p_description, p_ride_id::text);

    -- Check Account Activation Threshold
    IF v_new_balance <= -200 THEN
      UPDATE drivers SET status = 'suspended' WHERE id = v_driver_id;
      v_is_suspended := TRUE;
    END IF;

    -- If balance increases back above threshold, reactivate automatically (for later top-ups):
    IF v_new_balance > -200 THEN
      -- Check current status to see if we need to reactivate
      IF (SELECT status FROM drivers WHERE id = v_driver_id) = 'suspended' THEN
         UPDATE drivers SET status = 'approved' WHERE id = v_driver_id;
      END IF;
    END IF;

    RETURN json_build_object(
      'success', true, 
      'new_balance', v_new_balance, 
      'is_suspended', v_is_suspended
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
