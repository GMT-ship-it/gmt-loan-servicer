-- 13.1.1 Table to record adjustments (audit trail)
CREATE TABLE IF NOT EXISTS public.adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  adj_date date NOT NULL,
  kind text CHECK (kind IN ('principal','interest_receivable','fee_receivable','escrow','memo')) NOT NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  memo text,
  journal_entry_id bigint,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS for adjustments
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY adjustments_lender_all ON public.adjustments
  FOR ALL USING (is_lender(auth.uid()))
  WITH CHECK (is_lender(auth.uid()));

-- 13.1.2 Function: post an adjustment with correct accounts
CREATE OR REPLACE FUNCTION public.post_adjustment(
  p_loan_id uuid,
  p_adj_date date,
  p_kind text,
  p_amount numeric,
  p_memo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_acct_debit text;
  v_acct_credit text;
  v_amt numeric := p_amount;
BEGIN
  IF v_amt = 0 AND p_kind <> 'memo' THEN RETURN; END IF;
  SELECT organization_id INTO v_org FROM loans WHERE id = p_loan_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;

  IF p_kind = 'principal' THEN
    IF v_amt > 0 THEN v_acct_debit := 'AR_PRINCIPAL'; v_acct_credit := 'ADJ_OFFSET';
    ELSE v_acct_debit := 'ADJ_OFFSET'; v_acct_credit := 'AR_PRINCIPAL'; END IF;
  ELSIF p_kind = 'interest_receivable' THEN
    IF v_amt > 0 THEN v_acct_debit := 'INTEREST_RECEIVABLE'; v_acct_credit := 'ADJ_OFFSET';
    ELSE v_acct_debit := 'ADJ_OFFSET'; v_acct_credit := 'INTEREST_RECEIVABLE'; END IF;
  ELSIF p_kind = 'fee_receivable' THEN
    IF v_amt > 0 THEN v_acct_debit := 'FEE_RECEIVABLE'; v_acct_credit := 'ADJ_OFFSET';
    ELSE v_acct_debit := 'ADJ_OFFSET'; v_acct_credit := 'FEE_RECEIVABLE'; END IF;
  ELSIF p_kind = 'escrow' THEN
    IF v_amt > 0 THEN v_acct_debit := 'ADJ_OFFSET'; v_acct_credit := 'ESCROW_PAYABLE';
    ELSE v_acct_debit := 'ESCROW_PAYABLE'; v_acct_credit := 'ADJ_OFFSET'; END IF;
  ELSIF p_kind = 'memo' THEN
    INSERT INTO adjustments(loan_id, adj_date, kind, amount, memo, created_by)
    VALUES (p_loan_id, p_adj_date, 'memo', 0, coalesce(p_memo,'Memo'), auth.uid());
    RETURN;
  ELSE
    RAISE EXCEPTION 'Unknown adjustment kind: %', p_kind;
  END IF;

  INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo, created_by)
  VALUES
    (v_org, p_loan_id, p_adj_date, v_acct_debit,  abs(v_amt),  coalesce(p_memo,'Adjustment'), auth.uid()),
    (v_org, p_loan_id, p_adj_date, v_acct_credit, -abs(v_amt), coalesce(p_memo,'Adjustment'), auth.uid());

  INSERT INTO adjustments(loan_id, adj_date, kind, amount, memo, created_by)
  VALUES (p_loan_id, p_adj_date, p_kind, p_amount, p_memo, auth.uid());
END;
$$;

-- 13.1.3 View: quick balances snapshot for audit
CREATE OR REPLACE VIEW public.loan_balances_snapshot AS
SELECT
  l.id AS loan_id,
  public.principal_outstanding(l.id) AS principal_outstanding,
  coalesce((SELECT sum(amount) FROM journal_entries WHERE loan_id=l.id AND account_code='INTEREST_RECEIVABLE'),0) AS interest_receivable,
  coalesce((SELECT sum(amount) FROM journal_entries WHERE loan_id=l.id AND account_code='FEE_RECEIVABLE'),0) AS fee_receivable,
  coalesce((SELECT sum(amount) FROM journal_entries WHERE loan_id=l.id AND account_code='ESCROW_PAYABLE'),0) AS escrow_payable,
  coalesce((SELECT sum(amount) FROM journal_entries WHERE loan_id=l.id AND account_code='UNAPPLIED_CASH'),0) AS unapplied_cash
FROM loans l;

-- 13.2.1 Add non-accrual flag
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS non_accrual boolean DEFAULT false;

-- 13.2.2 Charge-off function
CREATE OR REPLACE FUNCTION public.charge_off_loan(p_loan_id uuid, p_co_date date, p_memo text DEFAULT 'Charge-off')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_prin numeric := 0;
  v_fee  numeric := 0;
  v_int  numeric := 0;
BEGIN
  SELECT organization_id INTO v_org FROM loans WHERE id = p_loan_id FOR UPDATE;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;

  SELECT public.principal_outstanding(p_loan_id) INTO v_prin;
  SELECT coalesce(sum(amount),0) INTO v_fee  FROM journal_entries WHERE loan_id=p_loan_id AND account_code='FEE_RECEIVABLE';
  SELECT coalesce(sum(amount),0) INTO v_int  FROM journal_entries WHERE loan_id=p_loan_id AND account_code='INTEREST_RECEIVABLE';

  IF v_prin > 0 THEN
    INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo, created_by)
    VALUES
      (v_org, p_loan_id, p_co_date, 'CHARGED_OFF_PRINCIPAL',  v_prin,  p_memo, auth.uid()),
      (v_org, p_loan_id, p_co_date, 'AR_PRINCIPAL',          -v_prin,  p_memo, auth.uid());
  END IF;

  IF v_fee > 0 THEN
    INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo, created_by)
    VALUES
      (v_org, p_loan_id, p_co_date, 'CHARGED_OFF_FEES',  v_fee,  p_memo, auth.uid()),
      (v_org, p_loan_id, p_co_date, 'FEE_RECEIVABLE',   -v_fee,  p_memo, auth.uid());
  END IF;

  IF v_int > 0 THEN
    INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo, created_by)
    VALUES
      (v_org, p_loan_id, p_co_date, 'INTEREST_REVERSAL',   v_int,  'Reverse interest receivable on charge-off', auth.uid()),
      (v_org, p_loan_id, p_co_date, 'INTEREST_RECEIVABLE', -v_int, 'Reverse interest receivable on charge-off', auth.uid());
  END IF;

  UPDATE loans
  SET status = 'charged_off',
      non_accrual = true,
      last_accrual_date = p_co_date
  WHERE id = p_loan_id;
END;
$$;