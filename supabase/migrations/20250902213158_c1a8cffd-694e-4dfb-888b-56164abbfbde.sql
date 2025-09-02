-- Recreate facility_principal view with security barrier
-- This ensures RLS from underlying tables (facilities/transactions) gates access

DROP VIEW IF EXISTS public.facility_principal;

CREATE OR REPLACE VIEW public.facility_principal
WITH (security_barrier) AS
SELECT
  f.id as facility_id,
  COALESCE(SUM(CASE WHEN t.type IN ('advance','fee','letter_of_credit','dof','adjustment') THEN t.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type IN ('payment') THEN t.amount ELSE 0 END), 0)
  AS principal_outstanding
FROM public.facilities f
LEFT JOIN public.transactions t ON t.facility_id = f.id
GROUP BY f.id;