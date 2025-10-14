-- 12.1.1 Tracking table for assessed fees
CREATE TABLE IF NOT EXISTS public.assessed_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_no int NOT NULL,
  due_date date NOT NULL,
  assessed_date date NOT NULL,
  amount numeric(18,2) NOT NULL,
  status text CHECK (status IN ('active','waived','paid')) DEFAULT 'active',
  journal_entry_id bigint,
  waiver_journal_entry_id bigint,
  created_at timestamptz DEFAULT now(),
  UNIQUE (loan_id, installment_no)
);

-- RLS for assessed_fees
ALTER TABLE public.assessed_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessed_fees_lender_all ON public.assessed_fees
  FOR ALL USING (is_lender(auth.uid()))
  WITH CHECK (is_lender(auth.uid()));

CREATE POLICY assessed_fees_borrower_read ON public.assessed_fees
  FOR SELECT USING (
    is_borrower(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = assessed_fees.loan_id
        AND l.borrower_id IN (
          SELECT b.id FROM borrowers b
          JOIN user_roles ur ON ur.user_id = auth.uid()
          WHERE b.organization_id = ur.organization_id
        )
    )
  );

-- 12.1.2 Helper: cumulative scheduled vs paid up to a date
CREATE OR REPLACE FUNCTION public.scheduled_vs_paid(p_loan_id uuid, p_asof date)
RETURNS TABLE(total_scheduled numeric, total_paid numeric)
LANGUAGE sql
STABLE
AS $$
  WITH sched AS (
    SELECT coalesce(sum(amount_due),0) AS s
    FROM loan_schedules
    WHERE loan_id = p_loan_id AND due_date <= p_asof
  ),
  pay AS (
    SELECT coalesce(sum(amount),0) AS p
    FROM payments
    WHERE loan_id = p_loan_id AND status='succeeded' AND received_at::date <= p_asof
  )
  SELECT s, p FROM sched, pay;
$$;

-- 12.1.3 Compute whether a specific installment is unpaid as of a date
CREATE OR REPLACE FUNCTION public.installment_unpaid(p_loan_id uuid, p_installment_no int, p_asof date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT sum(amount_due) AS sched_to_target
    FROM loan_schedules
    WHERE loan_id = p_loan_id AND installment_no <= p_installment_no
  ),
  paid AS (
    SELECT coalesce(sum(amount),0) AS total_paid
    FROM payments
    WHERE loan_id = p_loan_id AND status='succeeded' AND received_at::date <= p_asof
  )
  SELECT ( (SELECT sched_to_target FROM target) > (SELECT total_paid FROM paid) );
$$;

-- 12.1.4 Late fee calculator for one installment
CREATE OR REPLACE FUNCTION public.late_fee_amount_for_installment(p_loan_id uuid, p_installment_no int)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH rule AS (
    SELECT late_fee_type, late_fee_amount
    FROM loans WHERE id = p_loan_id
  ),
  inst AS (
    SELECT amount_due FROM loan_schedules
    WHERE loan_id = p_loan_id AND installment_no = p_installment_no
  )
  SELECT CASE
    WHEN (SELECT late_fee_type FROM rule) = 'flat'
      THEN coalesce((SELECT late_fee_amount FROM rule),0)
    WHEN (SELECT late_fee_type FROM rule) = 'percent'
      THEN round( coalesce((SELECT late_fee_amount FROM rule),0) * coalesce((SELECT amount_due FROM inst),0) / 100, 2)
    ELSE 0
  END;
$$;

-- 12.1.5 Assess late fees that newly qualify as of a date
CREATE OR REPLACE FUNCTION public.assess_late_fees_asof(p_asof date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_org uuid;
  v_inst record;
  v_grace int;
  v_fee numeric;
  v_due date;
  v_je_id bigint;
BEGIN
  FOR r IN
    SELECT id, organization_id, grace_days
    FROM loans
    WHERE status='active'
  LOOP
    v_org := r.organization_id;
    v_grace := coalesce(r.grace_days, 0);

    FOR v_inst IN
      SELECT ls.installment_no, ls.due_date
      FROM loan_schedules ls
      LEFT JOIN assessed_fees af
        ON af.loan_id = r.id AND af.installment_no = ls.installment_no
      WHERE ls.loan_id = r.id
        AND af.id IS NULL
        AND (ls.due_date + (v_grace || ' days')::interval)::date < p_asof
        AND public.installment_unpaid(r.id, ls.installment_no, p_asof)
      ORDER BY ls.installment_no
    LOOP
      v_due := v_inst.due_date;
      v_fee := public.late_fee_amount_for_installment(r.id, v_inst.installment_no);
      IF coalesce(v_fee,0) <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
      VALUES
        (v_org, r.id, p_asof, 'FEE_RECEIVABLE', v_fee, 'Late fee assessed'),
        (v_org, r.id, p_asof, 'LATE_FEE_INCOME', -v_fee, 'Late fee assessed')
      RETURNING id INTO v_je_id;

      INSERT INTO assessed_fees(loan_id, installment_no, due_date, assessed_date, amount, status, journal_entry_id)
      VALUES (r.id, v_inst.installment_no, v_due, p_asof, v_fee, 'active', v_je_id);
    END LOOP;
  END LOOP;
END;
$$;

-- 12.1.6 Mark fees paid automatically when waterfall clears FEE_RECEIVABLE
CREATE OR REPLACE FUNCTION public.sync_assessed_fees_paid()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE assessed_fees af
  SET status = 'paid'
  WHERE status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.loan_id = af.loan_id
        AND je.account_code = 'FEE_RECEIVABLE'
      GROUP BY je.loan_id
      HAVING sum(je.amount) > 0
    );
$$;

-- 12.1.7 Waiver function (reversing entry)
CREATE OR REPLACE FUNCTION public.waive_late_fee(p_fee_id uuid, p_waiver_date date, p_memo text DEFAULT 'Late fee waived')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  f assessed_fees%rowtype;
  v_org uuid;
  v_rev_id bigint;
BEGIN
  SELECT * INTO f FROM assessed_fees WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fee not found'; END IF;
  IF f.status <> 'active' THEN RETURN; END IF;

  SELECT organization_id INTO v_org FROM loans WHERE id = f.loan_id;

  INSERT INTO journal_entries(organization_id, loan_id, entry_date, account_code, amount, memo)
  VALUES
    (v_org, f.loan_id, p_waiver_date, 'FEE_RECEIVABLE', -f.amount, p_memo),
    (v_org, f.loan_id, p_waiver_date, 'LATE_FEE_INCOME',  f.amount, p_memo)
  RETURNING id INTO v_rev_id;

  UPDATE assessed_fees
  SET status = 'waived', waiver_journal_entry_id = v_rev_id
  WHERE id = p_fee_id;
END;
$$;