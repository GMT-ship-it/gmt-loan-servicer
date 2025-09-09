-- Fix covenants schema migration
-- Handle existing facility_covenants table properly

-- First, let's see what we have and transform it safely
-- Drop existing primary key constraint if it exists on facility_id
DO $$
BEGIN
  -- Check if facility_id is the primary key and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'facility_covenants' 
    AND tc.constraint_type = 'PRIMARY KEY'
    AND kcu.column_name = 'facility_id'
  ) THEN
    ALTER TABLE public.facility_covenants DROP CONSTRAINT facility_covenants_pkey;
  END IF;
END $$;

-- Add new columns if they don't exist
ALTER TABLE public.facility_covenants 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS kind text,
ADD COLUMN IF NOT EXISTS threshold numeric,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Set id as primary key if not already set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'facility_covenants' 
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name LIKE '%id%'
  ) THEN
    ALTER TABLE public.facility_covenants ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Update existing rows to have proper values
-- Convert existing records to max_utilization_pct covenants
UPDATE public.facility_covenants 
SET kind = 'max_utilization_pct',
    threshold = COALESCE(max_utilization_pct, 85.00)
WHERE kind IS NULL;

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
DROP POLICY IF EXISTS "breaches_lender_all" ON public.covenant_breaches;
CREATE POLICY "breaches_lender_all" ON public.covenant_breaches
FOR ALL TO authenticated 
USING (public.is_lender(auth.uid()))
WITH CHECK (public.is_lender(auth.uid()));

DROP POLICY IF EXISTS "breaches_borrower_read" ON public.covenant_breaches;
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

-- Update facility_covenants RLS
DROP POLICY IF EXISTS "cov_lender_all" ON public.facility_covenants;
CREATE POLICY "cov_lender_all" ON public.facility_covenants
FOR ALL TO authenticated
USING (public.is_lender(auth.uid()))
WITH CHECK (public.is_lender(auth.uid()));

DROP POLICY IF EXISTS "cov_borrower_read" ON public.facility_covenants;
CREATE POLICY "cov_borrower_read" ON public.facility_covenants
FOR SELECT TO authenticated
USING (
  public.is_borrower(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.id = facility_covenants.facility_id 
    AND f.customer_id = public.user_customer_id(auth.uid())
  )
);

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
    WHERE facility_id = p_facility AND COALESCE(is_active, true) = true
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
        AND COALESCE(fc.is_active, true) = true
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
        AND COALESCE(fc.is_active, true) = true
        AND COALESCE(bbc_age, 999) <= fc.threshold
    );
END;
$$;

-- Add BBC age covenants for facilities that don't have them yet
DO $$
DECLARE
  fac_rec RECORD;
BEGIN
  FOR fac_rec IN 
    SELECT f.id 
    FROM public.facilities f 
    WHERE f.status = 'active' 
    AND NOT EXISTS (
      SELECT 1 FROM public.facility_covenants fc 
      WHERE fc.facility_id = f.id AND fc.kind = 'bbc_max_age_days'
    )
  LOOP
    INSERT INTO public.facility_covenants (facility_id, kind, threshold, is_active)
    VALUES (fac_rec.id, 'bbc_max_age_days', 45, true);
  END LOOP;
END $$;

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