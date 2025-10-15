-- Patch audit_sensitive_changes to avoid referencing non-existent profiles.role
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Log role changes (safe when column doesn't exist)
  IF TG_TABLE_NAME = 'profiles' THEN
    IF (to_jsonb(OLD)->>'role') IS DISTINCT FROM (to_jsonb(NEW)->>'role') THEN
      INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (auth.uid(), 'role_change', TG_TABLE_NAME, NEW.id,
              jsonb_build_object('role', to_jsonb(OLD)->>'role'),
              jsonb_build_object('role', to_jsonb(NEW)->>'role'));
    END IF;
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
$function$;