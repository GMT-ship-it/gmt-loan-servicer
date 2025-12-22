-- Step 1: Drop functions that depend on the views
DROP FUNCTION IF EXISTS public.gl_entries_between(date, date);
DROP FUNCTION IF EXISTS public.payment_register_between(date, date);
DROP FUNCTION IF EXISTS public.borrower_activity_between(date, date);

-- Step 2: Drop views in correct dependency order (portfolio_dashboard depends on loan_delinquency_summary)
DROP VIEW IF EXISTS public.portfolio_dashboard;
DROP VIEW IF EXISTS public.loan_delinquency_summary;
DROP VIEW IF EXISTS public.loan_balances_snapshot;
DROP VIEW IF EXISTS public.loan_recent_payments;
DROP VIEW IF EXISTS public.escrow_summary;
DROP VIEW IF EXISTS public.v_gl_entries;
DROP VIEW IF EXISTS public.v_payment_register;
DROP VIEW IF EXISTS public.v_borrower_activity;

-- Step 3: Recreate views with security_invoker = true

-- loan_balances_snapshot
CREATE VIEW public.loan_balances_snapshot
WITH (security_invoker = true)
AS
SELECT id AS loan_id,
    principal_outstanding(id) AS principal_outstanding,
    COALESCE(( SELECT sum(journal_entries.amount) AS sum
           FROM journal_entries
          WHERE ((journal_entries.loan_id = l.id) AND (journal_entries.account_code = 'INTEREST_RECEIVABLE'::text))), (0)::numeric) AS interest_receivable,
    COALESCE(( SELECT sum(journal_entries.amount) AS sum
           FROM journal_entries
          WHERE ((journal_entries.loan_id = l.id) AND (journal_entries.account_code = 'FEE_RECEIVABLE'::text))), (0)::numeric) AS fee_receivable,
    COALESCE(( SELECT sum(journal_entries.amount) AS sum
           FROM journal_entries
          WHERE ((journal_entries.loan_id = l.id) AND (journal_entries.account_code = 'ESCROW_PAYABLE'::text))), (0)::numeric) AS escrow_payable,
    COALESCE(( SELECT sum(journal_entries.amount) AS sum
           FROM journal_entries
          WHERE ((journal_entries.loan_id = l.id) AND (journal_entries.account_code = 'UNAPPLIED_CASH'::text))), (0)::numeric) AS unapplied_cash
   FROM loans l;

-- loan_recent_payments
CREATE VIEW public.loan_recent_payments
WITH (security_invoker = true)
AS
SELECT loan_id,
    id AS payment_id,
    (received_at)::date AS paid_date,
    amount,
    COALESCE(((breakdown ->> 'principal'::text))::numeric, (0)::numeric) AS principal,
    COALESCE(((breakdown ->> 'interest'::text))::numeric, (0)::numeric) AS interest,
    COALESCE(((breakdown ->> 'fees'::text))::numeric, (0)::numeric) AS fees
   FROM payments
  WHERE (status = 'succeeded'::text);

-- escrow_summary
CREATE VIEW public.escrow_summary
WITH (security_invoker = true)
AS
SELECT e.loan_id,
    e.id AS escrow_id,
    e.balance AS escrow_balance,
    COALESCE(sum(
        CASE
            WHEN (t.kind = 'deposit'::text) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS deposits_total,
    COALESCE(sum(
        CASE
            WHEN (t.kind = 'disbursement'::text) THEN (- t.amount)
            ELSE (0)::numeric
        END), (0)::numeric) AS disbursements_total
   FROM (escrow_accounts e
     LEFT JOIN escrow_transactions t ON ((t.escrow_id = e.id)))
  GROUP BY e.loan_id, e.id, e.balance;

-- v_gl_entries
CREATE VIEW public.v_gl_entries
WITH (security_invoker = true)
AS
SELECT je.id AS journal_id,
    je.loan_id,
    l.loan_number,
    je.entry_date,
    je.account_code,
        CASE
            WHEN (je.amount > (0)::numeric) THEN je.amount
            ELSE (0)::numeric
        END AS debit,
        CASE
            WHEN (je.amount < (0)::numeric) THEN (- je.amount)
            ELSE (0)::numeric
        END AS credit,
    je.memo
   FROM (journal_entries je
     LEFT JOIN loans l ON ((l.id = je.loan_id)));

-- v_payment_register
CREATE VIEW public.v_payment_register
WITH (security_invoker = true)
AS
SELECT p.id AS payment_id,
    p.loan_id,
    l.loan_number,
    (p.received_at)::date AS received_date,
    p.amount AS amount_total,
    COALESCE(((p.breakdown ->> 'principal'::text))::numeric, (0)::numeric) AS principal,
    COALESCE(((p.breakdown ->> 'interest'::text))::numeric, (0)::numeric) AS interest,
    COALESCE(((p.breakdown ->> 'fees'::text))::numeric, (0)::numeric) AS fees
   FROM (payments p
     LEFT JOIN loans l ON ((l.id = p.loan_id)))
  WHERE (p.status = 'succeeded'::text);

-- v_borrower_activity
CREATE VIEW public.v_borrower_activity
WITH (security_invoker = true)
AS
SELECT b.id AS borrower_id,
    b.legal_name AS full_name,
    l.id AS loan_id,
    l.loan_number,
    je.entry_date,
    sum(
        CASE
            WHEN ((je.account_code = 'AR_PRINCIPAL'::text) AND (je.amount < (0)::numeric)) THEN (- je.amount)
            ELSE (0)::numeric
        END) AS principal_paid,
    sum(
        CASE
            WHEN ((je.account_code = 'INTEREST_RECEIVABLE'::text) AND (je.amount < (0)::numeric)) THEN (- je.amount)
            ELSE (0)::numeric
        END) AS interest_paid,
    sum(
        CASE
            WHEN ((je.account_code = 'FEE_RECEIVABLE'::text) AND (je.amount < (0)::numeric)) THEN (- je.amount)
            ELSE (0)::numeric
        END) AS fees_paid,
    sum(
        CASE
            WHEN ((je.account_code = 'ESCROW_PAYABLE'::text) AND (je.amount < (0)::numeric)) THEN (- je.amount)
            ELSE (0)::numeric
        END) AS escrow_disbursed,
    sum(
        CASE
            WHEN ((je.account_code = 'ESCROW_PAYABLE'::text) AND (je.amount > (0)::numeric)) THEN je.amount
            ELSE (0)::numeric
        END) AS escrow_deposited
   FROM ((journal_entries je
     JOIN loans l ON ((l.id = je.loan_id)))
     JOIN borrowers b ON ((b.id = l.borrower_id)))
  GROUP BY b.id, b.legal_name, l.id, l.loan_number, je.entry_date;

-- loan_delinquency_summary (needed before portfolio_dashboard)
CREATE VIEW public.loan_delinquency_summary
WITH (security_invoker = true)
AS
WITH pay AS (
         SELECT payments.loan_id,
            COALESCE(sum(payments.amount), (0)::numeric) AS total_paid
           FROM payments
          WHERE (payments.status = 'succeeded'::text)
          GROUP BY payments.loan_id
        ), sched AS (
         SELECT loan_schedules.loan_id,
            sum(loan_schedules.amount_due) FILTER (WHERE (loan_schedules.due_date <= (CURRENT_DATE - 1))) AS scheduled_through_yday,
            jsonb_agg(jsonb_build_object('installment_no', loan_schedules.installment_no, 'due_date', loan_schedules.due_date, 'amount_due', loan_schedules.amount_due) ORDER BY loan_schedules.due_date) AS sched_json
           FROM loan_schedules
          GROUP BY loan_schedules.loan_id
        ), agg AS (
         SELECT l.id AS loan_id,
            COALESCE(s.scheduled_through_yday, (0)::numeric) AS scheduled_through_yday,
            COALESCE(p.total_paid, (0)::numeric) AS total_paid,
            s.sched_json
           FROM ((loans l
             LEFT JOIN sched s ON ((s.loan_id = l.id)))
             LEFT JOIN pay p ON ((p.loan_id = l.id)))
        )
 SELECT loan_id,
    scheduled_through_yday,
    total_paid,
    GREATEST((scheduled_through_yday - total_paid), (0)::numeric) AS past_due_amount,
    ( WITH expanded AS (
                 SELECT ((elem.value ->> 'installment_no'::text))::integer AS n,
                    ((elem.value ->> 'due_date'::text))::date AS due_date,
                    ((elem.value ->> 'amount_due'::text))::numeric AS amt
                   FROM agg a2,
                    jsonb_array_elements(a.sched_json) elem(value)
                  WHERE (a2.loan_id = a.loan_id)
                  ORDER BY ((elem.value ->> 'due_date'::text))::date
                ), cum AS (
                 SELECT expanded.n,
                    expanded.due_date,
                    expanded.amt,
                    sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                   FROM expanded
                )
         SELECT min(cum.due_date) AS min
           FROM cum
          WHERE (cum.cum_sched > a.total_paid)) AS next_due_date,
        CASE
            WHEN (( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                      ORDER BY ((elem.value ->> 'due_date'::text))::date
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid)) IS NULL) THEN 0
            ELSE (CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                      ORDER BY ((elem.value ->> 'due_date'::text))::date
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid)))
        END AS days_past_due,
        CASE
            WHEN (GREATEST((scheduled_through_yday - total_paid), (0)::numeric) <= (0)::numeric) THEN 'CURRENT'::text
            WHEN (((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) >= 1) AND ((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) <= 30)) THEN '1-30'::text
            WHEN (((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) >= 31) AND ((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) <= 60)) THEN '31-60'::text
            WHEN (((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) >= 61) AND ((CURRENT_DATE - ( WITH expanded AS (
                     SELECT ((elem.value ->> 'due_date'::text))::date AS due_date,
                        ((elem.value ->> 'amount_due'::text))::numeric AS amt
                       FROM agg a2,
                        jsonb_array_elements(a.sched_json) elem(value)
                      WHERE (a2.loan_id = a.loan_id)
                    ), cum AS (
                     SELECT expanded.due_date,
                        expanded.amt,
                        sum(expanded.amt) OVER (ORDER BY expanded.due_date) AS cum_sched
                       FROM expanded
                    )
             SELECT max(cum.due_date) AS max
               FROM cum
              WHERE (cum.cum_sched > a.total_paid))) <= 90)) THEN '61-90'::text
            ELSE '90+'::text
        END AS bucket
   FROM agg a;

-- portfolio_dashboard (depends on loan_delinquency_summary)
CREATE VIEW public.portfolio_dashboard
WITH (security_invoker = true)
AS
SELECT l.id AS loan_id,
    l.loan_number,
    l.borrower_id,
    l.status,
    (l.created_at)::date AS origination_date,
    l.balloon_date AS maturity_date,
    l.interest_rate AS rate,
    principal_outstanding(l.id) AS principal_outstanding,
    COALESCE(( SELECT sum(journal_entries.amount) AS sum
           FROM journal_entries
          WHERE ((journal_entries.loan_id = l.id) AND (journal_entries.account_code = 'INTEREST_RECEIVABLE'::text))), (0)::numeric) AS accrued_interest,
    d.next_due_date,
    d.past_due_amount,
    d.days_past_due,
    d.bucket
   FROM (loans l
     LEFT JOIN loan_delinquency_summary d ON ((d.loan_id = l.id)))
  WHERE (l.status = ANY (ARRAY['active'::text, 'defaulted'::text]));

-- Step 4: Recreate the functions that depend on the views
CREATE OR REPLACE FUNCTION public.gl_entries_between(p_start date, p_end date)
 RETURNS SETOF v_gl_entries
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT * FROM v_gl_entries
  WHERE entry_date >= p_start AND entry_date <= p_end
  ORDER BY entry_date, journal_id;
$$;

CREATE OR REPLACE FUNCTION public.payment_register_between(p_start date, p_end date)
 RETURNS SETOF v_payment_register
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT * FROM v_payment_register
  WHERE received_date >= p_start AND received_date <= p_end
  ORDER BY received_date, payment_id;
$$;

CREATE OR REPLACE FUNCTION public.borrower_activity_between(p_start date, p_end date)
 RETURNS SETOF v_borrower_activity
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT * FROM v_borrower_activity
  WHERE entry_date >= p_start AND entry_date <= p_end
  ORDER BY full_name, loan_number, entry_date;
$$;