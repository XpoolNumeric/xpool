  -- Ensure Wallet Tables Exist (Safe to run again)
  CREATE TABLE IF NOT EXISTS public.driver_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE UNIQUE NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES public.driver_wallets(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
    description TEXT,
    reference_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS public.wallet_recharges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    cashfree_order_id VARCHAR(100),
    cashfree_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Updates to gracefully handle missing driver records and search_path
  CREATE OR REPLACE FUNCTION public.deduct_commission_and_check_wallet(
    p_driver_user_id UUID,
    p_amount DECIMAL,
    p_ride_id UUID,
    p_description TEXT DEFAULT 'Commission Deducted for Cash Trip'
  ) RETURNS JSON 
  LANGUAGE plpgsql 
  SECURITY DEFINER
  SET search_path = public
  AS $$
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
      -- Create the driver gracefully
      INSERT INTO drivers (user_id, status)
      VALUES (p_driver_user_id, 'approved')
      RETURNING id INTO v_driver_id;
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
  $$;



  CREATE OR REPLACE FUNCTION public.add_to_wallet(
    p_driver_user_id UUID,
    p_amount DECIMAL,
    p_ride_id UUID,
    p_description TEXT DEFAULT 'Ride earning'
  ) RETURNS VOID 
  LANGUAGE plpgsql 
  SECURITY DEFINER
  SET search_path = public 
  AS $$
  DECLARE 
    v_driver_id UUID;
    v_wallet_id UUID;
    v_new_balance DECIMAL;
  BEGIN
    -- Look up driver record from user_id
    SELECT id INTO v_driver_id 
    FROM drivers 
    WHERE user_id = p_driver_user_id 
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      INSERT INTO drivers (user_id, status)
      VALUES (p_driver_user_id, 'approved')
      RETURNING id INTO v_driver_id;
    END IF;

    -- Get or create wallet
    SELECT id INTO v_wallet_id 
    FROM driver_wallets 
    WHERE driver_id = v_driver_id;

    IF v_wallet_id IS NULL THEN
      INSERT INTO driver_wallets (driver_id, balance)
      VALUES (v_driver_id, p_amount)
      RETURNING id, balance INTO v_wallet_id, v_new_balance;
    ELSE
      UPDATE driver_wallets 
      SET balance = balance + p_amount, last_updated = NOW() 
      WHERE id = v_wallet_id
      RETURNING balance INTO v_new_balance;
    END IF;

    -- Record transaction
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (v_wallet_id, p_amount, 'credit', p_description, p_ride_id::text);

    -- Reactivate driver if balance is healthy again (strict greater than threshold)
    IF v_new_balance > -200 THEN
      IF (SELECT status FROM drivers WHERE id = v_driver_id) = 'suspended' THEN
         UPDATE drivers SET status = 'approved' WHERE id = v_driver_id;
      END IF;
    END IF;
  END;
  $$;
