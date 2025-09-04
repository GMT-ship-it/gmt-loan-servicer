-- Enums for industry sectors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'industry_sector') THEN
    CREATE TYPE industry_sector AS ENUM ('manufacturing','wholesale','retail','services','construction','energy','other');
  END IF;
END$$;

-- Facility covenants table
CREATE TABLE IF NOT EXISTS public.facility_covenants (
  facility_id uuid PRIMARY KEY REFERENCES public.facilities(id) ON DELETE CASCADE,
  max_utilization_pct numeric(5,2) NOT NULL DEFAULT 85.00,
  bbc_valid_days int NOT NULL DEFAULT 45,
  require_monthly_bbc boolean NOT NULL DEFAULT true,
  require_monthly_statement boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for facility_covenants
CREATE TRIGGER trg_fac_cov_updated
  BEFORE UPDATE ON public.facility_covenants
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- RLS for facility_covenants
ALTER TABLE public.facility_covenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cov_lender_all" ON public.facility_covenants;
CREATE POLICY "cov_lender_all" ON public.facility_covenants
  FOR ALL USING (public.is_lender(auth.uid())) WITH CHECK (public.is_lender(auth.uid()));

DROP POLICY IF EXISTS "cov_borrower_read" ON public.facility_covenants;
CREATE POLICY "cov_borrower_read" ON public.facility_covenants
  FOR SELECT USING (
    public.is_borrower(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.facilities f
      WHERE f.id = facility_covenants.facility_id
        AND f.customer_id = public.user_customer_id(auth.uid())
    )
  );

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_owner_crud" ON public.notifications;
CREATE POLICY "notif_owner_crud" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add industry/region fields to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sector industry_sector DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS region text;

-- Breach detection function for single facility
CREATE OR REPLACE FUNCTION public.facility_policy_breaches(p_facility uuid)
RETURNS TABLE (
  code text,
  severity text,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim numeric; v_prin numeric; v_util numeric;
  v_bbc_days int; v_has_fresh boolean; v_cov record;
  v_stmt_ok boolean;
BEGIN
  SELECT credit_limit INTO v_lim FROM public.facilities WHERE id = p_facility;
  SELECT (SELECT principal_outstanding FROM public.get_facility_principal(p_facility) LIMIT 1) INTO v_prin;
  v_util := CASE WHEN v_lim > 0 THEN round(100.0 * coalesce(v_prin,0) / v_lim, 2) ELSE 0 END;

  SELECT * INTO v_cov FROM public.facility_covenants WHERE facility_id = p_facility;
  IF v_cov IS NULL THEN
    SELECT coalesce(f.bbc_valid_days, 45) INTO v_bbc_days FROM public.facilities f WHERE f.id = p_facility;
  ELSE
    v_bbc_days := coalesce(v_cov.bbc_valid_days, 45);
  END IF;

  SELECT public.facility_has_recent_approved_bbc(p_facility, v_bbc_days) INTO v_has_fresh;

  -- UTILIZATION CHECK
  IF v_cov IS NOT NULL AND v_util > v_cov.max_utilization_pct THEN
    code := 'MAX_UTILIZATION';
    severity := 'warning';
    message := format('Utilization %.2f%% exceeds covenant %.2f%%', v_util, v_cov.max_utilization_pct);
    RETURN NEXT;
  END IF;

  -- BBC FRESHNESS CHECK
  IF (v_cov IS NULL OR v_cov.require_monthly_bbc) AND NOT v_has_fresh THEN
    code := 'BBC_STALE';
    severity := 'warning';
    message := format('No approved BBC within %s days', v_bbc_days);
    RETURN NEXT;
  END IF;

  -- STATEMENT CHECK
  IF v_cov IS NULL OR v_cov.require_monthly_statement THEN
    WITH bounds AS (
      SELECT date_trunc('month', current_date - interval '1 month')::date as s,
             (date_trunc('month', current_date) - interval '1 day')::date as e
    )
    SELECT EXISTS(
      SELECT 1 FROM public.transactions t, bounds b
      WHERE t.facility_id = p_facility AND t.effective_at::date BETWEEN b.s AND b.e
    ) INTO v_stmt_ok;

    IF NOT v_stmt_ok THEN
      code := 'STATEMENT_MISSING';
      severity := 'info';
      message := 'No transactions found last month (statement may be missing)';
      RETURN NEXT;
    END IF;
  END IF;

  RETURN;
END;
$$;

-- Portfolio-wide breach detection
CREATE OR REPLACE FUNCTION public.portfolio_policy_breaches()
RETURNS TABLE (
  facility_id uuid,
  customer_name text,
  code text,
  severity text,
  message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fac AS (
    SELECT f.id facility_id, c.legal_name customer_name
    FROM public.facilities f
    JOIN public.customers c ON c.id = f.customer_id
    WHERE f.status = 'active'
  )
  SELECT f.facility_id, f.customer_name, b.code, b.severity, b.message
  FROM fac f
  CROSS JOIN LATERAL public.facility_policy_breaches(f.facility_id) b;
$$;

-- Helper function to notify borrower users
CREATE OR REPLACE FUNCTION public.notify_borrower_users(p_facility uuid, p_type text, p_title text, p_body text, p_link text)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, p_type, p_title, p_body, p_link
  FROM public.profiles p
  JOIN public.facilities f ON f.customer_id = p.customer_id
  WHERE f.id = p_facility
    AND p.role IN ('borrower_admin','borrower_user')
    AND p.is_active = true;
END;
$$;

-- Portfolio aggregates view
CREATE OR REPLACE VIEW public.portfolio_aggregates
WITH (security_invoker = on) AS
SELECT
  c.sector,
  c.region,
  count(DISTINCT f.id) facilities,
  sum(f.credit_limit) credit_limit,
  sum((SELECT principal_outstanding FROM public.get_facility_principal(f.id) LIMIT 1)) principal_outstanding
FROM public.facilities f
JOIN public.customers c ON c.id = f.customer_id
WHERE f.status = 'active'
GROUP BY c.sector, c.region
ORDER BY principal_outstanding DESC NULLS LAST;

-- Utilization time-series function
CREATE OR REPLACE FUNCTION public.utilization_timeseries(
  p_facility uuid,
  p_days int DEFAULT 90
) 
RETURNS TABLE(
  d date,
  principal numeric,
  credit_limit numeric,
  utilization_pct numeric
) 
LANGUAGE sql 
STABLE 
SET search_path = public 
AS $$
  WITH dates AS (
    SELECT generate_series(current_date - (p_days||' days')::interval, current_date, interval '1 day')::date AS d
  ),
  pl AS (
    SELECT dt.d AS d,
           (SELECT coalesce(sum(
             CASE WHEN t.type IN ('advance','fee','letter_of_credit','dof','adjustment','interest') THEN t.amount
                  WHEN t.type = 'payment' THEN -t.amount ELSE 0 END
           ),0) FROM public.transactions t WHERE t.facility_id = p_facility AND t.effective_at::date <= dt.d) AS principal
    FROM dates dt
  ),
  lim AS (
    SELECT credit_limit FROM public.facilities WHERE id = p_facility
  )
  SELECT p.d,
         p.principal,
         (SELECT credit_limit FROM lim) AS credit_limit,
         CASE WHEN (SELECT credit_limit FROM lim) > 0
              THEN round(100.0 * p.principal / (SELECT credit_limit FROM lim), 2)
              ELSE 0 END AS utilization_pct
  FROM pl p
  ORDER BY p.d;
$$;