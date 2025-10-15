-- Add status tracking to user_roles for pending applications
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.user_roles.status IS 'Application status: pending_approval, active, rejected';

-- Add application fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS requested_amount NUMERIC,
ADD COLUMN IF NOT EXISTS financing_purpose TEXT;

COMMENT ON COLUMN public.customers.application_status IS 'Application status: pending, approved, rejected';

-- Add contact fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for pending applications query
CREATE INDEX IF NOT EXISTS idx_user_roles_status ON public.user_roles(status) WHERE status = 'pending_approval';

-- Drop and recreate RLS policy for profiles to allow pending users to read their own profile
DROP POLICY IF EXISTS "profiles_pending_self_read" ON public.profiles;
CREATE POLICY "profiles_pending_self_read" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR 
  is_lender(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.status = 'pending_approval'
  )
);

-- Drop and recreate policy to allow pending borrowers to read their own customer record
DROP POLICY IF EXISTS "customers_pending_borrower_read" ON public.customers;
CREATE POLICY "customers_pending_borrower_read" 
ON public.customers 
FOR SELECT 
USING (
  is_lender(auth.uid()) OR 
  (is_borrower(auth.uid()) AND id = user_customer_id(auth.uid())) OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.customer_id = customers.id 
    AND ur.user_id = auth.uid()
    AND ur.status = 'pending_approval'
  )
);