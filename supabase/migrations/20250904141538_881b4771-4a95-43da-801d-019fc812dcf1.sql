-- Fix security issues identified by the linter

-- Fix Function Search Path issues for all our new functions
-- Update validate_financial_amounts function to set proper search_path
CREATE OR REPLACE FUNCTION validate_financial_amounts()
RETURNS TRIGGER 
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

-- Update audit_sensitive_changes function to set proper search_path
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER 
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
  
  -- Log large transactions
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

-- Remove the security definer view and use a regular function approach instead
-- This addresses the Security Definer View warning
DROP VIEW IF EXISTS public.facility_principal_secure;

-- Update get_facility_principal to be more secure and avoid the security definer view issue
CREATE OR REPLACE FUNCTION public.get_facility_principal(p_facility_id uuid DEFAULT NULL)
RETURNS TABLE(facility_id uuid, principal_outstanding numeric)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- If no facility_id provided, return all facilities the user can access
  -- If facility_id provided, return only that one if user has access
  SELECT 
    fp.facility_id,
    fp.principal_outstanding
  FROM facility_principal fp
  JOIN facilities f ON f.id = fp.facility_id
  WHERE (p_facility_id IS NULL OR fp.facility_id = p_facility_id)
    AND (
      -- Lenders can see all
      is_lender(auth.uid()) OR 
      -- Borrowers can only see their own facilities
      (is_borrower(auth.uid()) AND f.customer_id = user_customer_id(auth.uid()))
    );
$$;

-- Add a note about leaked password protection
-- This is a Supabase Auth setting that needs to be enabled in the dashboard
-- We can't fix this via SQL migration, it needs to be done in Auth settings