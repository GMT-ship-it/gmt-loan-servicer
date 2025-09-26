-- Fix remaining functions without explicit search_path
CREATE OR REPLACE FUNCTION public.facility_has_recent_approved_bbc(p_facility uuid, p_days integer DEFAULT 45)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select exists (
    select 1
    from public.borrowing_base_reports r
    where r.facility_id = p_facility
      and r.status = 'approved'
      and r.period_end >= (current_date - make_interval(days => p_days))
  );
$function$;

CREATE OR REPLACE FUNCTION public.principal_as_of(p_facility uuid, p_as_of date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.statement_txns(p_facility uuid, p_start date, p_end date)
 RETURNS TABLE(id uuid, effective_at timestamp with time zone, type txn_type, amount numeric, memo text)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  SELECT t.id, t.effective_at, t.type, t.amount, t.memo
  FROM public.transactions t
  WHERE t.facility_id = p_facility
    AND t.effective_at::date >= p_start
    AND t.effective_at::date <= p_end
  ORDER BY t.effective_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.statement_header(p_facility uuid, p_start date, p_end date)
 RETURNS TABLE(opening_principal numeric, closing_principal numeric, interest_posted numeric, accrued_interest_eom numeric)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.utilization_timeseries(p_facility uuid, p_days integer DEFAULT 90)
 RETURNS TABLE(d date, principal numeric, credit_limit numeric, utilization_pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.facility_available_to_draw(p_facility uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  with principal as (
    select
      coalesce(sum(case when t.type in ('advance','fee','letter_of_credit','dof','adjustment') then t.amount else 0 end),0)
      - coalesce(sum(case when t.type = 'payment' then t.amount else 0 end),0) as principal_outstanding
    from public.transactions t
    where t.facility_id = p_facility
  )
  select greatest(
    0,
    f.credit_limit - coalesce((select principal_outstanding from principal), 0)
  )
  from public.facilities f
  where f.id = p_facility
$function$;

CREATE OR REPLACE FUNCTION public.is_lender(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select exists(
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('lender_admin','lender_analyst')
      and p.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_borrower(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select exists(
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('borrower_admin','borrower_user')
      and p.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_customer_id(uid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select customer_id
  from public.profiles
  where id = uid;
$function$;