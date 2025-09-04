-- Enable Row Level Security on facility_principal view
ALTER VIEW public.facility_principal ENABLE ROW LEVEL SECURITY;

-- Policy: Lenders can view all facility principal data
CREATE POLICY "facility_principal_lender_all" 
ON public.facility_principal 
FOR SELECT 
USING (is_lender(auth.uid()));

-- Policy: Borrowers can only view principal data for their own facilities
CREATE POLICY "facility_principal_borrower_own" 
ON public.facility_principal 
FOR SELECT 
USING (
  is_borrower(auth.uid()) AND 
  facility_id IN (
    SELECT f.id 
    FROM facilities f 
    WHERE f.customer_id = user_customer_id(auth.uid())
  )
);

-- Fix role escalation: Restrict profile updates to exclude role changes by non-lenders
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

CREATE POLICY "profiles_self_update_no_role" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  (
    -- Allow lenders to update any field including roles
    is_lender(auth.uid()) OR 
    -- Non-lenders can only update their own profile but not the role field
    (role = (SELECT role FROM profiles WHERE id = auth.uid()))
  )
);

-- Add server-side validation for critical numeric fields
CREATE OR REPLACE FUNCTION validate_financial_amounts()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Apply validation triggers
CREATE TRIGGER validate_transaction_amounts
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION validate_financial_amounts();

CREATE TRIGGER validate_facility_amounts
  BEFORE INSERT OR UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION validate_financial_amounts();

CREATE TRIGGER validate_draw_request_amounts
  BEFORE INSERT OR UPDATE ON draw_requests
  FOR EACH ROW EXECUTE FUNCTION validate_financial_amounts();

-- Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only lenders can read audit logs
CREATE POLICY "audit_log_lender_read" 
ON public.audit_log 
FOR SELECT 
USING (is_lender(auth.uid()));

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_transaction_changes
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_draw_changes
  AFTER UPDATE ON draw_requests
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();