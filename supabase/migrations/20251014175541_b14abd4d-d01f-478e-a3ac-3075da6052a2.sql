-- STEP 1: Payment allocation function
create or replace function public.apply_payment_waterfall(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay       payments%rowtype;
  v_org       uuid;
  v_fee_due   numeric := 0;
  v_int_due   numeric := 0;
  v_left      numeric := 0;
  v_fee_paid  numeric := 0;
  v_int_paid  numeric := 0;
  v_prin_paid numeric := 0;
begin
  -- Lock the payment row
  select * into v_pay from payments where id = p_payment_id for update;
  if v_pay.id is null then
    raise exception 'Payment % not found', p_payment_id;
  end if;
  if v_pay.status <> 'succeeded' then
    -- only allocate succeeded payments
    return;
  end if;

  -- org for journal entries
  select organization_id into v_org from loans where id = v_pay.loan_id;

  v_left := v_pay.amount;

  -- Current balances from the ledger (positive = debit, negative = credit)
  -- Interest/fee receivable balances should be >= 0 when there is something due.
  select coalesce(sum(amount),0) into v_int_due
  from journal_entries
  where loan_id = v_pay.loan_id and account_code = 'INTEREST_RECEIVABLE';

  select coalesce(sum(amount),0) into v_fee_due
  from journal_entries
  where loan_id = v_pay.loan_id and account_code = 'FEE_RECEIVABLE';

  -- 1) Debit CASH for the total payment received
  insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
  values (v_org, v_pay.loan_id, current_date, 'CASH', v_pay.amount, 'Payment received');

  -- 2) Fees first
  v_fee_paid := least(v_left, greatest(v_fee_due, 0));
  if v_fee_paid > 0 then
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values (v_org, v_pay.loan_id, current_date, 'FEE_RECEIVABLE', -v_fee_paid, 'Payment allocation: fees');
    v_left := v_left - v_fee_paid;
  end if;

  -- 3) Then interest
  v_int_paid := least(v_left, greatest(v_int_due, 0));
  if v_int_paid > 0 then
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values (v_org, v_pay.loan_id, current_date, 'INTEREST_RECEIVABLE', -v_int_paid, 'Payment allocation: interest');
    v_left := v_left - v_int_paid;
  end if;

  -- 4) Remainder to principal
  v_prin_paid := v_left;
  if v_prin_paid > 0 then
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values (v_org, v_pay.loan_id, current_date, 'AR_PRINCIPAL', -v_prin_paid, 'Payment allocation: principal');
    v_left := 0;
  end if;

  -- Optional: if any rounding dust remains, park it
  if v_left > 0.01 then
    insert into journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
    values (v_org, v_pay.loan_id, current_date, 'UNAPPLIED_CASH', -v_left, 'Unapplied remainder');
  end if;

  -- Update payment breakdown + received_at
  update payments
  set breakdown = jsonb_build_object(
        'fees', v_fee_paid,
        'interest', v_int_paid,
        'principal', v_prin_paid
      ),
      received_at = now()
  where id = v_pay.id;
end;
$$;

-- STEP 2: Trigger to run allocation whenever an admin inserts a succeeded payment
create or replace function public.trg_payments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'succeeded' then
    perform public.apply_payment_waterfall(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_after_insert on public.payments;
create trigger payments_after_insert
after insert on public.payments
for each row execute function public.trg_payments_after_insert();