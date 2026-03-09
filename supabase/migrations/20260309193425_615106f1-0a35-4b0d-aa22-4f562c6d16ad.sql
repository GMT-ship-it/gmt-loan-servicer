-- Fix 1: Drop the overly broad profiles_pending_self_read policy
-- that lets pending-approval users read ALL profiles
DROP POLICY IF EXISTS "profiles_pending_self_read" ON public.profiles;

-- The remaining policy "profiles_self_read_or_lender" already correctly restricts
-- SELECT to own row OR lender users, which is sufficient.