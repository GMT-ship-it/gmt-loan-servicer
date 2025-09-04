-- Fix audit function to handle tables without amount column
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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