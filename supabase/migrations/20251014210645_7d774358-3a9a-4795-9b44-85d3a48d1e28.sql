-- Step 16: Go-Live Checklist Implementation (Fixed)

-- 1) Create storage buckets for production
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('loan-documents', 'loan-documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('statements', 'statements', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Lenders can view all loan documents" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can upload loan documents" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can update loan documents" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can delete loan documents" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can view all statements" ON storage.objects;
  DROP POLICY IF EXISTS "Borrowers can view their own statements" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can upload statements" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can update statements" ON storage.objects;
  DROP POLICY IF EXISTS "Lenders can delete statements" ON storage.objects;
END $$;

-- RLS policies for loan-documents bucket (private, only lenders)
CREATE POLICY "Lenders can view all loan documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'loan-documents' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Lenders can upload loan documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Lenders can update loan documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'loan-documents' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Lenders can delete loan documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'loan-documents' 
  AND public.is_lender(auth.uid())
);

-- RLS policies for statements bucket (private, lenders + borrowers for own statements)
CREATE POLICY "Lenders can view all statements"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'statements' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Borrowers can view their own statements"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'statements'
  AND public.is_borrower(auth.uid())
  AND (storage.foldername(name))[1] IN (
    SELECT l.id::text
    FROM loans l
    WHERE l.borrower_id IN (
      SELECT b.id
      FROM borrowers b
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE b.organization_id = ur.organization_id
    )
  )
);

CREATE POLICY "Lenders can upload statements"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'statements' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Lenders can update statements"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'statements' 
  AND public.is_lender(auth.uid())
);

CREATE POLICY "Lenders can delete statements"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'statements' 
  AND public.is_lender(auth.uid())
);

-- 2) Create performance indexes for production load
CREATE INDEX IF NOT EXISTS idx_payments_loan_received ON public.payments(loan_id, received_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_loan_date ON public.journal_entries(loan_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_loan_schedules_loan_due ON public.loan_schedules(loan_id, due_date);
CREATE INDEX IF NOT EXISTS idx_statements_loan_period ON public.statements(loan_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_assessed_fees_loan ON public.assessed_fees(loan_id, status, assessed_date);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_escrow_date ON public.escrow_transactions(escrow_id, tx_date);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_borrowers_org ON public.borrowers(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_facilities_customer ON public.facilities(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_facility_date ON public.transactions(facility_id, effective_at);
CREATE INDEX IF NOT EXISTS idx_covenant_breaches_facility ON public.covenant_breaches(facility_id, status);

-- 3) Update non-accrual safety in run_daily_interest_accrual
CREATE OR REPLACE FUNCTION public.run_daily_interest_accrual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  r record;
  v_start date;
  v_end   date := current_date;
  v_days  int;
begin
  for r in
    select id, created_at::date as origination_date, coalesce(last_accrual_date, created_at::date) as last_dt
    from loans
    where status = 'active'
      and coalesce(non_accrual, false) = false  -- CRITICAL: Skip non-accrual loans
  loop
    v_start := greatest(r.last_dt + 1, r.origination_date);
    if v_start >= v_end then
      continue;
    end if;
    v_days := (v_end - v_start);
    if v_days > 0 then
      perform public.accrue_interest_for_loan(r.id, v_days, v_end - 1);
    end if;
  end loop;
end;
$$;

-- 4) Create helper function to check RLS status
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE(
  schema_name text,
  table_name text,
  rls_enabled boolean,
  rls_forced boolean,
  policy_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text as schema_name,
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    COUNT(p.polname) as policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relname NOT LIKE 'pg_%'
  GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  ORDER BY c.relname;
$$;