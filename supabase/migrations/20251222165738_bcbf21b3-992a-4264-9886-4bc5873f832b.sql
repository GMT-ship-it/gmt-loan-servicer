-- Fix the recursive RLS issue by making user_organization_id a SECURITY DEFINER function
-- This allows the function to bypass RLS when querying user_roles

CREATE OR REPLACE FUNCTION public.user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;