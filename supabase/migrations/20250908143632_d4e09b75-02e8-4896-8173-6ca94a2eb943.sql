-- Fix security issue: Replace portfolio_aggregates view with secure function
-- The view was exposing sensitive aggregate data to all users

-- Drop the existing view
DROP VIEW IF EXISTS public.portfolio_aggregates;

-- Create a security definer function that respects RLS policies
CREATE OR REPLACE FUNCTION public.get_portfolio_aggregates()
RETURNS TABLE(
  sector industry_sector,
  region text,
  facilities bigint,
  credit_limit numeric,
  principal_outstanding numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only allow lenders to access portfolio aggregates
  -- This prevents unauthorized access to sensitive financial data
  SELECT 
    c.sector,
    c.region,
    count(DISTINCT f.id) AS facilities,
    sum(f.credit_limit) AS credit_limit,
    sum((
      SELECT principal_outstanding 
      FROM public.get_facility_principal(f.id) 
      LIMIT 1
    )) AS principal_outstanding
  FROM facilities f
  JOIN customers c ON c.id = f.customer_id
  WHERE f.status = 'active'
    AND public.is_lender(auth.uid()) -- Only lenders can see aggregate data
  GROUP BY c.sector, c.region
  ORDER BY sum((
    SELECT principal_outstanding 
    FROM public.get_facility_principal(f.id) 
    LIMIT 1
  )) DESC NULLS LAST;
$$;