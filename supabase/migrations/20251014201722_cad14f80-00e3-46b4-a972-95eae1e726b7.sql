-- A) Due summary as of a date
create or replace function public.borrower_due_summary(p_loan_id uuid, p_asof date)
returns jsonb
language sql
stable
set search_path = public
as $$
with pay as (
  select coalesce(sum(amount),0)::numeric as total_paid
  from payments
  where loan_id = p_loan_id and status='succeeded' and received_at::date <= p_asof
),
sched as (
  select
    jsonb_agg(
      jsonb_build_object(
        'n', installment_no,
        'due', due_date,
        'amt', amount_due
      )
      order by due_date
    ) as items,
    sum(amount_due) filter (where due_date <= p_asof - 1) as scheduled_through_yday
  from loan_schedules where loan_id = p_loan_id
),
calc as (
  select
    s.items,
    coalesce(s.scheduled_through_yday,0) as scheduled_through_yday,
    p.total_paid
  from sched s, pay p
),
next_unpaid as (
  select
    (elem->>'due')::date as due_date,
    (elem->>'amt')::numeric as amount_due,
    sum((elem->>'amt')::numeric) over (order by (elem->>'due')::date) as cum_sched
  from calc c, jsonb_array_elements(c.items) elem
),
first_unpaid as (
  select due_date, amount_due
  from next_unpaid, calc
  where cum_sched > calc.total_paid
  order by due_date asc
  limit 1
)
select jsonb_build_object(
  'next_due_date', (select due_date from first_unpaid),
  'past_due_amount', greatest((select scheduled_through_yday from calc) - (select total_paid from calc), 0),
  'amount_due_today',
    case
      when (select due_date from first_unpaid) is null then 0
      when (select due_date from first_unpaid) <= p_asof
        then greatest((select scheduled_through_yday from calc) - (select total_paid from calc), 0) + (select amount_due from first_unpaid)
      else greatest((select scheduled_through_yday from calc) - (select total_paid from calc), 0)
    end
);
$$;

-- B) Recent payments view (borrower-friendly)
create or replace view public.loan_recent_payments as
select
  loan_id,
  id as payment_id,
  received_at::date as paid_date,
  amount,
  coalesce((breakdown->>'principal')::numeric,0) as principal,
  coalesce((breakdown->>'interest')::numeric,0)  as interest,
  coalesce((breakdown->>'fees')::numeric,0)      as fees
from payments
where status='succeeded';