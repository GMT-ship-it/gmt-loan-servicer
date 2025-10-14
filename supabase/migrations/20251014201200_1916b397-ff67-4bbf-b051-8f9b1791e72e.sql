-- 7.1.1 Add interest-only months (optional; default 0)
alter table public.loans
  add column if not exists interest_only_months int default 0;

-- 7.1.2 Create schedule table
create table if not exists public.loan_schedules (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete cascade,
  installment_no int not null,
  due_date date not null,
  amount_due numeric(18,2) not null,
  interest_portion numeric(18,2) not null default 0,
  principal_portion numeric(18,2) not null default 0,
  created_at timestamptz default now(),
  unique (loan_id, installment_no)
);

-- RLS policies for loan_schedules
alter table public.loan_schedules enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Admins and analysts can manage schedules" on public.loan_schedules;
drop policy if exists "Borrowers can view their schedules" on public.loan_schedules;

-- Create policies
create policy "Admins and analysts can manage schedules"
on public.loan_schedules for all
using (
  is_admin_or_analyst(auth.uid()) and 
  loan_id in (select id from loans where organization_id = user_organization_id(auth.uid()))
);

create policy "Borrowers can view their schedules"
on public.loan_schedules for select
using (
  has_role(auth.uid(), 'borrower'::app_role) and
  loan_id in (
    select l.id from loans l
    join borrowers b on b.id = l.borrower_id
    join user_roles ur on ur.user_id = auth.uid()
    where b.organization_id = ur.organization_id
  )
);

-- 7.1.3 Generator: monthly schedule with optional interest-only period
create or replace function public.generate_monthly_schedule(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v loans%rowtype;
  v_io int;
  v_amort int;
  v_r_month numeric;
  v_pmt numeric;
  v_prin numeric;
  v_due date;
  i int;
  v_int numeric;
  v_pp numeric;
begin
  select * into v from loans where id = p_loan_id for update;
  if v.id is null then raise exception 'Loan not found'; end if;
  if v.payment_frequency <> 'monthly' then
    raise exception 'Only monthly frequency supported in this step';
  end if;

  delete from loan_schedules where loan_id = v.id;

  v_io := coalesce(v.interest_only_months, 0);
  v_amort := v.term_months - v_io;
  if v_amort < 0 then v_amort := 0; end if;

  v_r_month := round(v.interest_rate / 12.0, 10);
  v_prin := v.principal;
  v_due := v.first_payment_date;

  for i in 1..v_io loop
    insert into loan_schedules(loan_id, installment_no, due_date, amount_due, interest_portion, principal_portion)
    values (v.id, i, v_due, round(v_prin * v_r_month, 2), round(v_prin * v_r_month, 2), 0);
    v_due := (v_due + interval '1 month')::date;
  end loop;

  if v_amort > 0 then
    if v_r_month = 0 then
      v_pmt := round(v_prin / v_amort, 2);
    else
      v_pmt := round(v_prin * (v_r_month / (1 - power(1+v_r_month, -v_amort))), 2);
    end if;

    for i in 1..v_amort loop
      v_int := round(v_prin * v_r_month, 2);
      v_pp := greatest(round(v_pmt - v_int, 2), 0);
      if v_pp > v_prin then v_pp := v_prin; end if;

      insert into loan_schedules(loan_id, installment_no, due_date, amount_due, interest_portion, principal_portion)
      values (v.id, v_io + i, v_due, v_int + v_pp, v_int, v_pp);

      v_prin := round(v_prin - v_pp, 2);
      v_due := (v_due + interval '1 month')::date;
    end loop;
  end if;
end;
$$;

-- 7.1.4 Run once for existing active loans
do $$
declare r record;
begin
  for r in select id from loans where status='active' loop
    perform public.generate_monthly_schedule(r.id);
  end loop;
end $$;

-- 7.1.5 Delinquency summary view
create or replace view public.loan_delinquency_summary as
with pay as (
  select
    loan_id,
    coalesce(sum(amount),0)::numeric as total_paid
  from payments
  where status='succeeded'
  group by loan_id
),
sched as (
  select
    loan_id,
    sum(amount_due) filter (where due_date <= current_date - 1)::numeric as scheduled_through_yday,
    jsonb_agg(
      jsonb_build_object(
        'installment_no', installment_no,
        'due_date', due_date,
        'amount_due', amount_due
      )
      order by due_date asc
    ) as sched_json
  from loan_schedules
  group by loan_id
),
agg as (
  select
    l.id as loan_id,
    coalesce(s.scheduled_through_yday,0) as scheduled_through_yday,
    coalesce(p.total_paid,0) as total_paid,
    s.sched_json
  from loans l
  left join sched s on s.loan_id = l.id
  left join pay p on p.loan_id = l.id
)
select
  a.loan_id,
  a.scheduled_through_yday,
  a.total_paid,
  greatest(a.scheduled_through_yday - a.total_paid, 0)::numeric as past_due_amount,
  (
    with expanded as (
      select
        (elem->>'installment_no')::int as n,
        (elem->>'due_date')::date as due_date,
        (elem->>'amount_due')::numeric as amt
      from agg a2, jsonb_array_elements(a.sched_json) elem
      where a2.loan_id = a.loan_id
      order by due_date
    ),
    cum as (
      select
        *,
        sum(amt) over (order by due_date) as cum_sched
      from expanded
    )
    select min(due_date) from cum where cum_sched > a.total_paid
  ) as next_due_date,
  (
    case
      when (
        with expanded as (
          select (elem->>'due_date')::date as due_date,
                 (elem->>'amount_due')::numeric as amt
          from agg a2, jsonb_array_elements(a.sched_json) elem
          where a2.loan_id = a.loan_id
          order by due_date
        ),
        cum as (
          select *, sum(amt) over (order by due_date) as cum_sched
          from expanded
        )
        select max(due_date) from cum where cum_sched > a.total_paid
      ) is null then 0
      else (current_date - (
        with expanded as (
          select (elem->>'due_date')::date as due_date,
                 (elem->>'amount_due')::numeric as amt
          from agg a2, jsonb_array_elements(a.sched_json) elem
          where a2.loan_id = a.loan_id
          order by due_date
        ),
        cum as (
          select *, sum(amt) over (order by due_date) as cum_sched
          from expanded
        )
        select max(due_date) from cum where cum_sched > a.total_paid
      ))::int
    end
  ) as days_past_due,
  (
    case
      when greatest(a.scheduled_through_yday - a.total_paid, 0) <= 0 then 'CURRENT'
      when (current_date - (
        with expanded as (
          select (elem->>'due_date')::date as due_date, (elem->>'amount_due')::numeric as amt
          from agg a2, jsonb_array_elements(a.sched_json) elem
          where a2.loan_id = a.loan_id
        ),
        cum as (select *, sum(amt) over (order by due_date) as cum_sched from expanded)
        select max(due_date) from cum where cum_sched > a.total_paid
      )) between 1 and 30 then '1-30'
      when (current_date - (
        with expanded as (
          select (elem->>'due_date')::date as due_date, (elem->>'amount_due')::numeric as amt
          from agg a2, jsonb_array_elements(a.sched_json) elem
          where a2.loan_id = a.loan_id
        ),
        cum as (select *, sum(amt) over (order by due_date) as cum_sched from expanded)
        select max(due_date) from cum where cum_sched > a.total_paid
      )) between 31 and 60 then '31-60'
      when (current_date - (
        with expanded as (
          select (elem->>'due_date')::date as due_date, (elem->>'amount_due')::numeric as amt
          from agg a2, jsonb_array_elements(a.sched_json) elem
          where a2.loan_id = a.loan_id
        ),
        cum as (select *, sum(amt) over (order by due_date) as cum_sched from expanded)
        select max(due_date) from cum where cum_sched > a.total_paid
      )) between 61 and 90 then '61-90'
      else '90+'
    end
  ) as bucket
from agg a;