-- Create facilities_labeled view for friendly names
create or replace view public.facilities_labeled
with (security_invoker = on) as
select
  f.id as facility_id,
  c.legal_name as customer_name,
  left(f.id::text, 8) as short_id,
  f.credit_limit, f.apr, f.status, f.type, f.customer_id
from public.facilities f
join public.customers c on c.id = f.customer_id;

-- Add BBC validity configuration per facility
alter table public.facilities add column if not exists bbc_valid_days int not null default 45;

-- Update facility_has_recent_approved_bbc to use configurable days
create or replace function public.facility_has_recent_approved_bbc(
  p_facility uuid,
  p_days int default null
) returns boolean language sql stable set search_path=public as $$
  with dd as (
    select coalesce(p_days, f.bbc_valid_days, 45) as days
    from public.facilities f where f.id = p_facility
  )
  select exists (
    select 1
    from public.borrowing_base_reports r, dd
    where r.facility_id = p_facility
      and r.status = 'approved'
      and r.period_end >= current_date - make_interval(days => (select days from dd))
  );
$$;

-- Latest BBC snapshot helper
create or replace function public.latest_bbc_snapshot(p_facility uuid)
returns table (
  id uuid, period_end date, status public.bbc_status,
  gross_collateral numeric, ineligibles numeric, reserves numeric,
  advance_rate numeric, borrowing_base numeric, availability numeric
) language sql stable set search_path=public as $$
  select r.id, r.period_end, r.status, r.gross_collateral, r.ineligibles, r.reserves,
         r.advance_rate, r.borrowing_base, r.availability
  from public.borrowing_base_reports r
  where r.facility_id = p_facility
  order by r.period_end desc
  limit 1;
$$;

-- Month ranges helper for backfill statements
create or replace function public.month_ranges(p_start date, p_end date)
returns table (month_start date, month_end date)
language sql stable set search_path=public as $$
  select date_trunc('month', dd)::date as month_start,
         (date_trunc('month', dd) + interval '1 month - 1 day')::date as month_end
  from generate_series(p_start, p_end, interval '1 month') dd;
$$;

-- Add MFA requirement to profiles
alter table public.profiles add column if not exists mfa_required boolean not null default false;

-- Set MFA required for lender roles
update public.profiles set mfa_required = true where role in ('lender_admin','lender_analyst');

-- Prevent duplicate interest posting per day
create unique index if not exists uniq_interest_post_per_day
on public.transactions (facility_id, (effective_at::date), memo)
where type = 'interest';

-- Update interest posting to be idempotent
create or replace function public.post_interest_for_facility(
  p_facility uuid,
  p_as_of date default current_date
) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_amount numeric(16,2);
begin
  select round(coalesce(public.facility_accrued_interest(p_facility, p_as_of), 0)::numeric, 2)
  into v_amount;

  if v_amount is null or v_amount <= 0 then
    return 0;
  end if;

  begin
    insert into public.transactions (facility_id, type, amount, effective_at, memo, created_by)
    values (p_facility, 'interest', v_amount, (p_as_of + time '23:59:00'), 'Interest posted through '||p_as_of::text, null);
  exception when unique_violation then
    -- already posted for that day; treat as idempotent
    return 0;
  end;

  return v_amount;
end;
$$;