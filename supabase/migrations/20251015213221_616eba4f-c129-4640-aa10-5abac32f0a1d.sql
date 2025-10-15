-- 1) Create borrower_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.borrower_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  industry text,
  business_address text,
  full_name text NOT NULL,
  title text,
  email text NOT NULL,
  phone text,
  requested_amount numeric(18,2) NOT NULL,
  purpose text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.borrower_applications ENABLE ROW LEVEL SECURITY;

-- 3) Allow authenticated users to insert their own application rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'borrower_applications' AND policyname = 'applicant_can_insert_own'
  ) THEN
    CREATE POLICY "applicant_can_insert_own"
    ON public.borrower_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());
  END IF;
END$$;