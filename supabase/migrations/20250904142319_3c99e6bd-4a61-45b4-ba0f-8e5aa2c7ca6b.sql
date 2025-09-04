-- Drop the insecure facility_principal view
-- All access should go through the secure get_facility_principal function
DROP VIEW IF EXISTS public.facility_principal;