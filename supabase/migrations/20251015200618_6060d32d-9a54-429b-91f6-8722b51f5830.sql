-- Fix validate_financial_amounts trigger to only check amount on tables that have it
CREATE OR REPLACE FUNCTION public.validate_financial_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only validate amount column if the table actually has it
  IF TG_TABLE_NAME IN ('transactions', 'draw_requests', 'payments', 'adjustments', 'escrow_transactions') THEN
    IF NEW.amount IS NOT NULL THEN
      IF NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
      END IF;
      IF NEW.amount > 100000000 THEN
        RAISE EXCEPTION 'Amount exceeds maximum allowed value';
      END IF;
    END IF;
  END IF;
  
  -- Validate credit limits for facilities
  IF TG_TABLE_NAME = 'facilities' AND (to_jsonb(NEW)->>'credit_limit') IS NOT NULL THEN
    IF (to_jsonb(NEW)->>'credit_limit')::numeric <= 0 THEN
      RAISE EXCEPTION 'Credit limit must be positive';
    END IF;
    IF (to_jsonb(NEW)->>'credit_limit')::numeric > 1000000000 THEN
      RAISE EXCEPTION 'Credit limit exceeds maximum allowed value';
    END IF;
  END IF;
  
  -- Validate APR for facilities
  IF TG_TABLE_NAME = 'facilities' AND (to_jsonb(NEW)->>'apr') IS NOT NULL THEN
    IF (to_jsonb(NEW)->>'apr')::numeric < 0 OR (to_jsonb(NEW)->>'apr')::numeric > 1 THEN
      RAISE EXCEPTION 'APR must be between 0 and 1 (0%% to 100%%)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;