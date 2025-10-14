-- STEP 2: DAILY INTEREST ACCRUAL JOB

-- 2.1: Add a last_accrual_date column to track accrual progress
alter table public.loans
  add column if not exists last_accrual_date date;

-- 2.2: Compute principal outstanding using payments.breakdown->'principal'
--      (This avoids requiring origination JEs right now.)
create or replace function public.principal_outstanding(p_loan_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  with base as (
    select l.principal::numeric as starting_principal
    from loans l
    where l.id = p_loan_id
  ),
  paid as (
    select coalesce(sum((p.breakdown->>'principal')::numeric), 0) as principal_paid
    from payments p
    where p.loan_id = p_loan_id
      and p.status = 'succeeded'
  )
  select greatest((b.starting_principal - p.principal_paid), 0)
  from base b cross join paid p;
$$;

-- 2.3: Accrue interest for a single loan for N days (handles ACT/365 and 30/360)
create or replace function public.accrue_interest_for_loan(p_loan_id uuid, p_days int, p_asof date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_basis text;
  v_rate numeric;             -- annual nominal rate (e.g., 0.12)
  v_prin numeric;             -- principal outstanding
  v_days int := greatest(p_days, 0);
  v_interest numeric := 0;
begin
  if v_days <= 0 then
    return;
  end if;

  select l.organization_id, l.compounding_basis, l.interest_rate
  into v_org, v_basis, v_rate
  from loans l
  where l.id = p_loan_id
    and l.status = 'active'
  for update;

  if v_org is null then
    return; -- loan not active or not found
  end if;

  -- principal outstanding as of p_asof (simple model: principal – sum(principal paid))
  v_prin := public.principal_outstanding(p_loan_id);

  if v_prin <= 0 then
    -- Nothing to accrue
    update loans set last_accrual_date = p_asof where id = p_loan_id;
    return;
  end if;

  -- Daily accrual math
  if v_basis = 'ACT/365' then
    v_interest := round(v_prin * v_rate * (v_days::numeric / 365), 2);
  elsif v_basis = '30/360' then
    -- For a daily job, treat 30/360 as 360-day denominator.
    v_interest := round(v_prin * v_rate * (v_days::numeric / 360), 2);
  else
    -- Default to ACT/365 if unspecified
    v_interest := round(v_prin * v_rate * (v_days::numeric / 365), 2);
  end if;

  if v_interest <= 0 then
    update loans set last_accrual_date = p_asof where id = p_loan_id;
    return;
  end if;

  -- Post the accrual JE (debit receivable, credit income)
  insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
  values
    (v_org, p_loan_id, p_asof, 'INTEREST_RECEIVABLE',  v_interest,  'Daily interest accrual'),
    (v_org, p_loan_id, p_asof, 'INTEREST_INCOME',     -v_interest, 'Daily interest accrual');

  -- Advance last_accrual_date to p_asof
  update loans
  set last_accrual_date = p_asof
  where id = p_loan_id;
end;
$$;

-- 2.4: Runner that accrues *missed* days since last_accrual_date (idempotent per day)
create or replace function public.run_daily_interest_accrual()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_start date;
  v_end   date := current_date;
  v_days  int;
begin
  for r in
    select id, created_at::date as origination_date, coalesce(last_accrual_date, created_at::date) as last_dt
    from loans
    where status = 'active'
  loop
    -- We accrue from the day after last_accrual_date up to yesterday
    v_start := greatest(r.last_dt + 1, r.origination_date);
    if v_start >= v_end then
      continue; -- nothing to do today
    end if;
    v_days := (v_end - v_start); -- number of days to accrue
    if v_days > 0 then
      -- Accrue in one lump for simplicity (daily granularity is the same sum)
      perform public.accrue_interest_for_loan(r.id, v_days, v_end - 1);
    end if;
  end loop;
end;
$$;

-- 2.5: Schedule with pg_cron: run at 02:00 America/Chicago daily
create extension if not exists pg_cron with schema extensions;

select
  cron.schedule(
    'loan-daily-accrual',
    '0 2 * * *',
    $$select public.run_daily_interest_accrual();$$
  );
