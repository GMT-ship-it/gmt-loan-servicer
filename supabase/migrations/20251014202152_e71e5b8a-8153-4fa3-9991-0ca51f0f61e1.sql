-- Portfolio dashboard view with delinquency and balance info
create or replace view public.portfolio_dashboard as
select
  l.id as loan_id,
  l.loan_number,
  l.borrower_id,
  l.status,
  l.created_at::date as origination_date,
  l.balloon_date as maturity_date,
  l.interest_rate as rate,
  public.principal_outstanding(l.id) as principal_outstanding,
  -- accrued interest
  coalesce((
    select sum(amount) from journal_entries
    where loan_id = l.id and account_code = 'INTEREST_RECEIVABLE'
  ),0) as accrued_interest,
  -- delinquency fields from your summary view
  d.next_due_date,
  d.past_due_amount,
  d.days_past_due,
  d.bucket
from loans l
left join loan_delinquency_summary d on d.loan_id = l.id
where l.status in ('active','defaulted');