-- Fix security definer view issue by recreating facility_principal view with security_invoker
-- This ensures the view respects RLS policies based on the current user's permissions

DROP VIEW IF EXISTS public.facility_principal;

CREATE VIEW public.facility_principal
WITH (security_invoker = true) AS
SELECT 
    t.facility_id,
    COALESCE(
        SUM(CASE WHEN t.type IN ('advance','fee','letter_of_credit','dof','adjustment') THEN t.amount ELSE 0 END), 0
    ) - COALESCE(
        SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0
    ) AS principal_outstanding
FROM public.transactions t
GROUP BY t.facility_id;