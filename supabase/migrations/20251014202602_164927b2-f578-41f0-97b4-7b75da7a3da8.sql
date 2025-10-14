-- 10.1.2 Ledger posting function for escrow tx
create or replace function public.escrow_post_transaction(
  p_loan_id uuid,
  p_tx_date date,
  p_amount numeric,   -- positive for deposit, negative for disbursement
  p_memo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_escrow_id uuid;
  v_amt numeric := p_amount;
begin
  if v_amt = 0 then return; end if;

  select organization_id into v_org from loans where id = p_loan_id;
  if v_org is null then raise exception 'Loan not found %', p_loan_id; end if;

  -- ensure escrow account row
  select id into v_escrow_id from escrow_accounts where loan_id = p_loan_id;
  if v_escrow_id is null then
    insert into escrow_accounts(loan_id, balance) values (p_loan_id, 0)
    returning id into v_escrow_id;
  end if;

  -- ledger: deposit increases ESCROW_PAYABLE (credit), disbursement decreases (debit)
  if v_amt > 0 then
    -- deposit
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values
      (v_org, p_loan_id, p_tx_date, 'CASH',           v_amt,              coalesce(p_memo,'Escrow deposit')),
      (v_org, p_loan_id, p_tx_date, 'ESCROW_PAYABLE', -v_amt,             coalesce(p_memo,'Escrow deposit'));
    insert into escrow_transactions(escrow_id, tx_date, amount, kind, memo)
    values (v_escrow_id, p_tx_date, v_amt, 'deposit', p_memo);
    update escrow_accounts set balance = coalesce(balance,0) + v_amt where id = v_escrow_id;

  else
    -- disbursement (v_amt < 0)
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values
      (v_org, p_loan_id, p_tx_date, 'ESCROW_PAYABLE',  -v_amt,             coalesce(p_memo,'Escrow disbursement')),
      (v_org, p_loan_id, p_tx_date, 'CASH',             v_amt,              coalesce(p_memo,'Escrow disbursement'));
    insert into escrow_transactions(escrow_id, tx_date, amount, kind, memo)
    values (v_escrow_id, p_tx_date, v_amt, 'disbursement', p_memo);
    update escrow_accounts set balance = coalesce(balance,0) + v_amt where id = v_escrow_id;
  end if;
end;
$$;

-- 10.1.3 Escrow summary view (as-of today)
create or replace view public.escrow_summary as
select
  e.loan_id,
  e.id as escrow_id,
  e.balance as escrow_balance,
  coalesce(sum(case when t.kind='deposit' then t.amount else 0 end),0) as deposits_total,
  coalesce(sum(case when t.kind='disbursement' then -t.amount else 0 end),0) as disbursements_total
from escrow_accounts e
left join escrow_transactions t on t.escrow_id = e.id
group by e.loan_id, e.id, e.balance;