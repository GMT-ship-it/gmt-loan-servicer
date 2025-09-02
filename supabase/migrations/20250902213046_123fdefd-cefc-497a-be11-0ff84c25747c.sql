-- CRITICAL SECURITY FIX: Add RLS policies to facility_principal table
-- This table contains sensitive financial data and currently has NO access controls

-- Enable RLS on facility_principal table
ALTER TABLE public.facility_principal ENABLE ROW LEVEL SECURITY;

-- Allow lenders full access to all facility principal data
CREATE POLICY "facility_principal_lender_all" 
ON public.facility_principal 
FOR ALL 
USING (is_lender(auth.uid()))
WITH CHECK (is_lender(auth.uid()));

-- Allow borrowers to read only their own facility principal data
CREATE POLICY "facility_principal_borrower_read" 
ON public.facility_principal 
FOR SELECT 
USING (
  is_borrower(auth.uid()) 
  AND EXISTS (
    SELECT 1 
    FROM facilities f 
    WHERE f.id = facility_principal.facility_id 
    AND f.customer_id = user_customer_id(auth.uid())
  )
);

-- SECURITY IMPROVEMENT: Fix database functions to prevent function hijacking
-- Update existing functions to include proper search_path settings

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  insert into public.profiles (id, role, full_name, is_active)
  values (new.id, 'borrower_user', new.raw_user_meta_data->>'full_name', true)
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_lender(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  select exists(
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('lender_admin','lender_analyst')
      and p.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_borrower(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  select exists(
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('borrower_admin','borrower_user')
      and p.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_customer_id(uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  select customer_id
  from public.profiles
  where id = uid;
$function$;