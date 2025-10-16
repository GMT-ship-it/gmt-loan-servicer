-- Update is_lender function to use user_roles table
CREATE OR REPLACE FUNCTION public.is_lender(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role IN ('admin', 'analyst')
      AND ur.status = 'active'
  );
$$;

-- Update is_borrower function to use user_roles table
CREATE OR REPLACE FUNCTION public.is_borrower(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role = 'borrower'
      AND ur.status = 'active'
  );
$$;