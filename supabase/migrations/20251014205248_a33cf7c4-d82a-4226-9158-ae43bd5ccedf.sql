-- A) GL entries by period (normalized debits/credits)
CREATE OR REPLACE VIEW public.v_gl_entries AS
SELECT
  je.id AS journal_id,
  je.loan_id,
  l.loan_number,
  je.entry_date,
  je.account_code,
  CASE WHEN je.amount > 0 THEN je.amount ELSE 0 END AS debit,
  CASE WHEN je.amount < 0 THEN -je.amount ELSE 0 END AS credit,
  je.memo
FROM journal_entries je
LEFT JOIN loans l ON l.id = je.loan_id;

-- B) Payment register (succeeded only)
CREATE OR REPLACE VIEW public.v_payment_register AS
SELECT
  p.id AS payment_id,
  p.loan_id,
  l.loan_number,
  p.received_at::date AS received_date,
  p.amount AS amount_total,
  coalesce((p.breakdown->>'principal')::numeric,0) AS principal,
  coalesce((p.breakdown->>'interest')::numeric,0) AS interest,
  coalesce((p.breakdown->>'fees')::numeric,0) AS fees
FROM payments p
LEFT JOIN loans l ON l.id = p.loan_id
WHERE p.status = 'succeeded';

-- C) Borrower activity rollup by period
CREATE OR REPLACE VIEW public.v_borrower_activity AS
SELECT
  b.id AS borrower_id,
  b.legal_name AS full_name,
  l.id AS loan_id,
  l.loan_number,
  je.entry_date,
  sum(CASE WHEN je.account_code='AR_PRINCIPAL' AND je.amount<0 THEN -je.amount ELSE 0 END) AS principal_paid,
  sum(CASE WHEN je.account_code='INTEREST_RECEIVABLE' AND je.amount<0 THEN -je.amount ELSE 0 END) AS interest_paid,
  sum(CASE WHEN je.account_code='FEE_RECEIVABLE' AND je.amount<0 THEN -je.amount ELSE 0 END) AS fees_paid,
  sum(CASE WHEN je.account_code='ESCROW_PAYABLE' AND je.amount<0 THEN -je.amount ELSE 0 END) AS escrow_disbursed,
  sum(CASE WHEN je.account_code='ESCROW_PAYABLE' AND je.amount>0 THEN je.amount ELSE 0 END) AS escrow_deposited
FROM journal_entries je
JOIN loans l ON l.id = je.loan_id
JOIN borrowers b ON b.id = l.borrower_id
GROUP BY b.id, b.legal_name, l.id, l.loan_number, je.entry_date;

-- D) Convenience RPCs (filter by date range)
CREATE OR REPLACE FUNCTION public.gl_entries_between(p_start date, p_end date)
RETURNS SETOF v_gl_entries
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM v_gl_entries
  WHERE entry_date >= p_start AND entry_date <= p_end
  ORDER BY entry_date, journal_id;
$$;

CREATE OR REPLACE FUNCTION public.payment_register_between(p_start date, p_end date)
RETURNS SETOF v_payment_register
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM v_payment_register
  WHERE received_date >= p_start AND received_date <= p_end
  ORDER BY received_date, payment_id;
$$;

CREATE OR REPLACE FUNCTION public.borrower_activity_between(p_start date, p_end date)
RETURNS SETOF v_borrower_activity
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM v_borrower_activity
  WHERE entry_date >= p_start AND entry_date <= p_end
  ORDER BY full_name, loan_number, entry_date;
$$;