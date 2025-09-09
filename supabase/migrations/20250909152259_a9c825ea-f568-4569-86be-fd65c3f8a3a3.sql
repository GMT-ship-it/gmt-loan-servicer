-- Create comprehensive covenants system with proper schema
-- This replaces the existing facility_covenants approach with a more robust system

-- First, let's work with the existing facility_covenants table structure
-- Update it to match what the UI expects
ALTER TABLE public.facility_covenants 
ADD COLUMN IF NOT EXISTS kind text DEFAULT 'max_utilization_pct',
ADD COLUMN IF NOT EXISTS threshold numeric DEFAULT 85.00,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- If id column was just added, make it primary key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'facility_covenants' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.facility_covenants ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Create covenant_breaches table
CREATE TABLE IF NOT EXISTS public.covenant_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  covenant_id uuid,
  kind text NOT NULL,
  observed_value numeric NOT NULL,
  threshold_value numeric NOT NULL,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text,
  acknowledged_by uuid,
  waived_by uuid,
  cleared_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on covenant_breaches
ALTER TABLE public.covenant_breaches ENABLE ROW LEVEL SECURITY;

-- RLS policies for covenant_breaches
CREATE POLICY "breaches_lender_all" ON public.covenant_breaches
FOR ALL TO authenticated 
USING (public.is_lender(auth.uid()))
WITH CHECK (public.is_lender(auth.uid()));

CREATE POLICY "breaches_borrower_read" ON public.covenant_breaches
FOR SELECT TO authenticated
USING (
  public.is_borrower(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.id = covenant_breaches.facility_id 
    AND f.customer_id = public.user_customer_id(auth.uid())
  )
);

-- Update existing facility_covenants RLS to allow the new columns
DROP POLICY IF EXISTS "cov_lender_all" ON public.facility_covenants;
CREATE POLICY "cov_lender_all" ON public.facility_covenants
FOR ALL TO authenticated
USING (public.is_lender(auth.uid()))
WITH CHECK (public.is_lender(auth.uid()));

-- Function to get facility utilization percentage
CREATE OR REPLACE FUNCTION public.facility_utilization_pct(p_facility uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH principal AS (
    SELECT (
      SELECT principal_outstanding 
      FROM public.get_facility_principal(p_facility) 
      LIMIT 1
    ) AS outstanding
  ),
  facility AS (
    SELECT credit_limit FROM public.facilities WHERE id = p_facility
  )
  SELECT 
    CASE 
      WHEN f.credit_limit > 0 THEN 
        ROUND(100.0 * COALESCE(p.outstanding, 0) / f.credit_limit, 2)
      ELSE 0 
    END
  FROM facility f, principal p;
$$;

-- Function to get BBC age in days
CREATE OR REPLACE FUNCTION public.facility_bbc_age_days(p_facility uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN MAX(r.period_end) IS NULL THEN NULL
      ELSE (CURRENT_DATE - MAX(r.period_end))::integer
    END
  FROM public.borrowing_base_reports r
  WHERE r.facility_id = p_facility
    AND r.status = 'approved';
$$;

-- Main covenant evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_covenants(p_facility uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cov_rec RECORD;
  util_pct numeric;
  bbc_age integer;
  breach_exists boolean;
BEGIN
  -- Get current metrics
  SELECT public.facility_utilization_pct(p_facility) INTO util_pct;
  SELECT public.facility_bbc_age_days(p_facility) INTO bbc_age;
  
  -- Process each active covenant
  FOR cov_rec IN 
    SELECT * FROM public.facility_covenants 
    WHERE facility_id = p_facility AND is_active = true
  LOOP
    breach_exists := false;
    
    -- Check max utilization breach
    IF cov_rec.kind = 'max_utilization_pct' AND util_pct > cov_rec.threshold THEN
      -- Check if breach already exists and is open
      SELECT EXISTS(
        SELECT 1 FROM public.covenant_breaches 
        WHERE facility_id = p_facility 
          AND kind = 'max_utilization_pct'
          AND status = 'open'
      ) INTO breach_exists;
      
      IF NOT breach_exists THEN
        INSERT INTO public.covenant_breaches (
          facility_id, covenant_id, kind, observed_value, threshold_value, status
        ) VALUES (
          p_facility, cov_rec.id, 'max_utilization_pct', util_pct, cov_rec.threshold, 'open'
        );
      END IF;
    END IF;
    
    -- Check BBC age breach
    IF cov_rec.kind = 'bbc_max_age_days' AND bbc_age > cov_rec.threshold THEN
      SELECT EXISTS(
        SELECT 1 FROM public.covenant_breaches 
        WHERE facility_id = p_facility 
          AND kind = 'bbc_max_age_days'
          AND status = 'open'
      ) INTO breach_exists;
      
      IF NOT breach_exists THEN
        INSERT INTO public.covenant_breaches (
          facility_id, covenant_id, kind, observed_value, threshold_value, status
        ) VALUES (
          p_facility, cov_rec.id, 'bbc_max_age_days', bbc_age, cov_rec.threshold, 'open'
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Auto-clear breaches that are no longer valid
  -- Clear utilization breaches if back in compliance
  UPDATE public.covenant_breaches 
  SET status = 'cleared', closed_at = now()
  WHERE facility_id = p_facility 
    AND kind = 'max_utilization_pct'
    AND status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.facility_covenants fc
      WHERE fc.facility_id = p_facility 
        AND fc.kind = 'max_utilization_pct'
        AND fc.is_active = true
        AND util_pct <= fc.threshold
    );
    
  -- Clear BBC age breaches if fresh BBC submitted
  UPDATE public.covenant_breaches 
  SET status = 'cleared', closed_at = now()
  WHERE facility_id = p_facility 
    AND kind = 'bbc_max_age_days'
    AND status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.facility_covenants fc
      WHERE fc.facility_id = p_facility 
        AND fc.kind = 'bbc_max_age_days'
        AND fc.is_active = true
        AND bbc_age <= fc.threshold
    );
END;
$$;

-- Trigger to auto-evaluate covenants on transactions
CREATE OR REPLACE FUNCTION public.auto_evaluate_covenants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Evaluate covenants when transactions are added
  IF TG_OP = 'INSERT' THEN
    PERFORM public.evaluate_covenants(NEW.facility_id);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS auto_covenant_evaluation ON public.transactions;
CREATE TRIGGER auto_covenant_evaluation
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_evaluate_covenants();

-- Create default covenants for existing active facilities
DO $$
DECLARE
  fac_rec RECORD;
BEGIN
  FOR fac_rec IN SELECT id FROM public.facilities WHERE status = 'active' LOOP
    -- Add default max utilization covenant if not exists
    INSERT INTO public.facility_covenants (facility_id, kind, threshold, is_active)
    SELECT fac_rec.id, 'max_utilization_pct', 85.00, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.facility_covenants 
      WHERE facility_id = fac_rec.id AND kind = 'max_utilization_pct'
    );
    
    -- Add default BBC age covenant if not exists
    INSERT INTO public.facility_covenants (facility_id, kind, threshold, is_active)
    SELECT fac_rec.id, 'bbc_max_age_days', 45, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.facility_covenants 
      WHERE facility_id = fac_rec.id AND kind = 'bbc_max_age_days'
    );
  END LOOP;
END $$;