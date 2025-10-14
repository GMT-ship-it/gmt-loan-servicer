-- Add helper functions for borrower portal

-- 1) Accrued interest helper (sum of INTEREST_RECEIVABLE)
create or replace function public.accrued_interest(p_loan_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount),0)
  from journal_entries
  where loan_id = p_loan_id
    and account_code = 'INTEREST_RECEIVABLE';
$$;

-- 2) Payoff quote as of date (principal + accrued interest + fees − unapplied cash)
create or replace function public.payoff_quote(p_loan_id uuid, p_asof date)
returns numeric
language sql
stable
as $$
with prin as (
  select public.principal_outstanding(p_loan_id) as v
),
int as (
  select public.accrued_interest(p_loan_id) as v
),
fees as (
  select coalesce(sum(amount),0) as v
  from journal_entries
  where loan_id = p_loan_id and account_code = 'FEE_RECEIVABLE'
),
unapplied as (
  select coalesce(sum(amount),0) as v
  from journal_entries
  where loan_id = p_loan_id and account_code = 'UNAPPLIED_CASH'
)
select greatest( (prin.v + int.v + fees.v - unapplied.v), 0 )
from prin,int,fees,unapplied;
$$;