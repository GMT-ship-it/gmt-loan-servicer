-- A) Per-loan escrow settings (projected annuals + cushion)
create table if not exists public.escrow_settings (
  loan_id uuid primary key references public.loans(id) on delete cascade,
  proj_tax_annual numeric(18,2) default 0,
  proj_ins_annual numeric(18,2) default 0,
  cushion_months int default 2,
  updated_at timestamptz default now()
);

-- B) Add monthly escrow requirement & cushion to loans
alter table public.loans
  add column if not exists escrow_monthly_required numeric(18,2) default 0,
  add column if not exists escrow_cushion_required numeric(18,2) default 0;

-- C) Recalc function: sets the loan's monthly requirement & cushion today
create or replace function public.recalc_escrow_requirements(p_loan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_monthly numeric := 0;
  v_cushion numeric := 0;
  v_total_annual numeric := 0;
begin
  select * into s from escrow_settings where loan_id = p_loan_id;
  if not found then
    update loans set escrow_monthly_required = 0, escrow_cushion_required = 0 where id = p_loan_id;
    return jsonb_build_object('monthly_required',0,'cushion_required',0);
  end if;
  v_total_annual := coalesce(s.proj_tax_annual,0) + coalesce(s.proj_ins_annual,0);
  v_monthly := round(v_total_annual / 12.0, 2);
  v_cushion := round(v_monthly * greatest(coalesce(s.cushion_months,2),0), 2);

  update loans
  set escrow_monthly_required = v_monthly,
      escrow_cushion_required = v_cushion
  where id = p_loan_id;

  return jsonb_build_object('monthly_required', v_monthly, 'cushion_required', v_cushion);
end;
$$;

-- D) Add escrow_portion to schedule
alter table public.loan_schedules
  add column if not exists escrow_portion numeric(18,2) default 0;

-- E) Update schedule generator to include escrow
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
  v_amt numeric;
  v_escrow_monthly numeric := 0;
begin
  select * into v from loans where id = p_loan_id for update;
  if v.id is null then raise exception 'Loan not found'; end if;
  if v.payment_frequency <> 'monthly' then
    raise exception 'Only monthly frequency supported in this step';
  end if;

  v_escrow_monthly := coalesce(v.escrow_monthly_required, 0);
  delete from loan_schedules where loan_id = v.id;

  v_io := coalesce(v.interest_only_months, 0);
  v_amort := v.term_months - v_io;
  if v_amort < 0 then v_amort := 0; end if;

  v_r_month := round(v.interest_rate / 12.0, 10);
  v_prin := v.principal;
  v_due := v.first_payment_date;

  for i in 1..v_io loop
    v_int := round(v_prin * v_r_month, 2);
    v_amt := v_int + v_escrow_monthly;
    insert into loan_schedules(loan_id, installment_no, due_date, amount_due, interest_portion, principal_portion, escrow_portion)
    values (v.id, i, v_due, v_amt, v_int, 0, v_escrow_monthly);
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

      insert into loan_schedules(loan_id, installment_no, due_date, amount_due, interest_portion, principal_portion, escrow_portion)
      values (v.id, v_io + i, v_due, v_int + v_pp + v_escrow_monthly, v_int, v_pp, v_escrow_monthly);

      v_prin := round(v_prin - v_pp, 2);
      v_due := (v_due + interval '1 month')::date;
    end loop;
  end if;
end;
$$;

-- F) Shortage/surplus function
create or replace function public.escrow_shortage_surplus(p_loan_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
with s as (
  select escrow_monthly_required as monthly, escrow_cushion_required as cushion
  from loans where id = p_loan_id
),
b as (
  select coalesce(balance,0) as bal
  from escrow_accounts where loan_id = p_loan_id
)
select jsonb_build_object(
  'balance', coalesce((select bal from b),0),
  'monthly_required', coalesce((select monthly from s),0),
  'cushion_required', coalesce((select cushion from s),0),
  'shortage', greatest(coalesce((select cushion from s),0) - coalesce((select bal from b),0), 0),
  'surplus', greatest(coalesce((select bal from b),0) - coalesce((select cushion from s),0), 0)
);
$$;