-- Principal as of a date (end-of-day p_as_of)
CREATE OR REPLACE FUNCTION public.principal_as_of(
  p_facility uuid,
  p_as_of date
) RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH tx AS (
    SELECT
      CASE
        WHEN t.type IN ('advance','fee','letter_of_credit','dof','adjustment','interest') THEN t.amount
        WHEN t.type = 'payment' THEN -t.amount
        ELSE 0
      END AS delta
    FROM public.transactions t
    WHERE t.facility_id = p_facility
      AND t.effective_at::date <= p_as_of
  )
  SELECT coalesce(sum(delta),0)::numeric FROM tx;
$$;

-- Statement lines for a period [p_start, p_end]
CREATE OR REPLACE FUNCTION public.statement_txns(
  p_facility uuid,
  p_start date,
  p_end date
) RETURNS TABLE (
  id uuid,
  effective_at timestamptz,
  type public.txn_type,
  amount numeric,
  memo text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT t.id, t.effective_at, t.type, t.amount, t.memo
  FROM public.transactions t
  WHERE t.facility_id = p_facility
    AND t.effective_at::date >= p_start
    AND t.effective_at::date <= p_end
  ORDER BY t.effective_at ASC;
$$;

-- Statement header/snapshot (opening/closing/accrued interest)
CREATE OR REPLACE FUNCTION public.statement_header(
  p_facility uuid,
  p_start date,
  p_end date
) RETURNS TABLE(
  opening_principal numeric,
  closing_principal numeric,
  interest_posted numeric,
  accrued_interest_eom numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH opening AS (
    SELECT public.principal_as_of(p_facility, p_start - 1) AS opening_principal
  ),
  closing AS (
    SELECT public.principal_as_of(p_facility, p_end) AS closing_principal
  ),
  interest_posted AS (
    SELECT coalesce(sum(amount),0)::numeric AS interest_posted
    FROM public.transactions
    WHERE facility_id = p_facility
      AND type = 'interest'
      AND effective_at::date >= p_start
      AND effective_at::date <= p_end
  ),
  accrued AS (
    -- accrued (unposted) as of period end, via your function
    SELECT coalesce(public.facility_accrued_interest(p_facility, p_end),0)::numeric AS accrued_interest_eom
  )
  SELECT o.opening_principal, c.closing_principal, i.interest_posted, a.accrued_interest_eom
  FROM opening o, closing c, interest_posted i, accrued a;
$$;

-- Lender exposure snapshot (one row per facility)
CREATE OR REPLACE FUNCTION public.lender_exposure_snapshot()
RETURNS TABLE (
  facility_id uuid,
  customer_name text,
  credit_limit numeric,
  principal_outstanding numeric,
  available_to_draw numeric,
  utilization_pct numeric,
  last_bbc_date date,
  bbc_approved_within_45d boolean,
  last_draw_decided_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fac AS (
    SELECT f.id AS facility_id, f.credit_limit, c.legal_name AS customer_name
    FROM public.facilities f
    JOIN public.customers c ON c.id = f.customer_id
    WHERE f.status = 'active'
  ),
  principal AS (
    SELECT
      g.facility_id,
      max(g.principal_outstanding) AS principal_outstanding
    FROM (
      -- get current principal via your secure function
      SELECT f.facility_id,
             (SELECT principal_outstanding FROM public.get_facility_principal(f.facility_id) LIMIT 1) AS principal_outstanding
      FROM fac f
    ) g
    GROUP BY g.facility_id
  ),
  avail AS (
    SELECT
      f.facility_id,
      public.facility_available_to_draw(f.facility_id) AS available_to_draw
    FROM fac f
  ),
  bbc AS (
    SELECT
      r.facility_id,
      max(r.period_end) FILTER (WHERE r.status = 'approved') AS last_bbc_date,
      bool_or(r.status = 'approved' AND r.period_end >= current_date - make_interval(days => 45)) AS bbc_approved_within_45d
    FROM public.borrowing_base_reports r
    GROUP BY r.facility_id
  ),
  last_draw AS (
    SELECT dr.facility_id, max(dr.decided_at) AS last_draw_decided_at
    FROM public.draw_requests dr
    WHERE dr.status = 'approved'
    GROUP BY dr.facility_id
  )
  SELECT
    f.facility_id,
    f.customer_name,
    f.credit_limit,
    coalesce(p.principal_outstanding,0) AS principal_outstanding,
    coalesce(a.available_to_draw,0) AS available_to_draw,
    CASE WHEN f.credit_limit > 0 THEN round(100.0 * coalesce(p.principal_outstanding,0) / f.credit_limit, 2) ELSE 0 END AS utilization_pct,
    b.last_bbc_date,
    coalesce(b.bbc_approved_within_45d,false) AS bbc_approved_within_45d,
    ld.last_draw_decided_at
  FROM fac f
  LEFT JOIN principal p ON p.facility_id = f.facility_id
  LEFT JOIN avail a ON a.facility_id = f.facility_id
  LEFT JOIN bbc b ON b.facility_id = f.facility_id
  LEFT JOIN last_draw ld ON ld.facility_id = f.facility_id
  ORDER BY utilization_pct DESC NULLS LAST;
$$;