-- Fix function search path security warnings
-- Ensure all existing functions have proper search_path set

-- Update existing functions that may not have search_path set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, role, full_name, is_active)
  values (new.id, 'borrower_user', new.raw_user_meta_data->>'full_name', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Update audit functions
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log role changes
  IF TG_TABLE_NAME = 'profiles' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'role_change', TG_TABLE_NAME, NEW.id, 
            jsonb_build_object('role', OLD.role), 
            jsonb_build_object('role', NEW.role));
  END IF;
  
  -- Log large transactions - only for transactions table
  IF TG_TABLE_NAME = 'transactions' AND NEW.amount > 100000 THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'large_transaction', TG_TABLE_NAME, NEW.id,
            jsonb_build_object('amount', NEW.amount, 'type', NEW.type));
  END IF;
  
  -- Log draw request approvals
  IF TG_TABLE_NAME = 'draw_requests' AND OLD.status != NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'draw_decision', TG_TABLE_NAME, NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status, 'decision_notes', NEW.decision_notes));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update validation functions
CREATE OR REPLACE FUNCTION public.validate_financial_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate amounts are positive and reasonable
  IF NEW.amount IS NOT NULL THEN
    IF NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Amount must be positive';
    END IF;
    IF NEW.amount > 100000000 THEN  -- 100M limit
      RAISE EXCEPTION 'Amount exceeds maximum allowed value';
    END IF;
  END IF;
  
  -- Validate credit limits for facilities
  IF TG_TABLE_NAME = 'facilities' AND NEW.credit_limit IS NOT NULL THEN
    IF NEW.credit_limit <= 0 THEN
      RAISE EXCEPTION 'Credit limit must be positive';
    END IF;
    IF NEW.credit_limit > 1000000000 THEN  -- 1B limit
      RAISE EXCEPTION 'Credit limit exceeds maximum allowed value';
    END IF;
  END IF;
  
  -- Validate APR for facilities
  IF TG_TABLE_NAME = 'facilities' AND NEW.apr IS NOT NULL THEN
    IF NEW.apr < 0 OR NEW.apr > 1 THEN
      RAISE EXCEPTION 'APR must be between 0 and 1 (0%% to 100%%)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;