-- Compute accrued (unposted) interest for a facility as of a date.
-- Basis: 365. Interest = principal * (APR/365) * days_per_interval, summed over intervals.
-- Excludes already-posted 'interest' transactions (we assume those reset accrual).
create or replace function public.facility_accrued_interest(
  p_facility uuid,
  p_as_of date default current_date
) returns numeric
language sql
stable
set search_path = public
as $$
with params as (
  select f.apr::numeric as apr
  from public.facilities f
  where f.id = p_facility
),
-- only principal-moving types (exclude 'interest' postings)
tx as (
  select
    t.id,
    t.effective_at::date as dte,
    case
      when t.type in ('advance','fee','letter_of_credit','dof','adjustment') then t.amount
      when t.type = 'payment' then -t.amount
      else 0
    end as delta
  from public.transactions t
  where t.facility_id = p_facility
    and t.effective_at::date <= p_as_of
    and t.type <> 'interest'
),
-- add an origin row (day before the first tx) so we can accrue from the beginning
anchors as (
  select dte, delta from tx
  union all
  select (select coalesce(min(dte), p_as_of) - 1 from tx), 0
),
-- order cashflow dates & compute running principal end-of-day
ordered as (
  select
    dte,
    sum(delta) over (order by dte rows between unbounded preceding and current row) as principal_eod
  from anchors
),
-- compute intervals between days where principal is constant:
-- interval starts at this dte, ends at next dte or p_as_of
spans as (
  select
    o.dte as span_start,
    lead(o.dte, 1, p_as_of) over (order by o.dte) as span_end,
    o.principal_eod
  from ordered o
),
-- only accrue for positive-length spans within the accrual window
normalized as (
  select
    greatest(span_start, (select min(dte) from ordered)) as s,
    span_end as e,
    principal_eod
  from spans
),
days as (
  select
    s,
    e,
    principal_eod,
    greatest(0, (e - s))::int as day_count
  from normalized
)
select
  coalesce(sum(
    case when principal_eod > 0 then
      principal_eod * (select apr from params) / 365.0 * day_count
    else 0 end
  ), 0)::numeric
from days;
$$;