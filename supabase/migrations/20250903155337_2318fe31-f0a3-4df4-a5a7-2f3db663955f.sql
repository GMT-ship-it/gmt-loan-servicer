-- Fix security warnings: Add search_path to existing functions
CREATE OR REPLACE FUNCTION public.is_lender(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
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
 SET search_path = public
AS $function$
  select customer_id
  from public.profiles
  where id = uid;
$function$;