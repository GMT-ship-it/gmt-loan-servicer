-- Fix security issue: Add RLS policies to portfolio_aggregates table
-- This table contains sensitive financial data and should only be accessible to lenders

-- Enable Row Level Security on portfolio_aggregates table
ALTER TABLE public.portfolio_aggregates ENABLE ROW LEVEL SECURITY;

-- Add policy to allow only lenders to read portfolio aggregate data
CREATE POLICY "portfolio_agg_lender_read" 
ON public.portfolio_aggregates
FOR SELECT 
USING (public.is_lender(auth.uid()));

-- Verify the policy is working by testing access patterns
-- Lenders (lender_admin, lender_analyst) should be able to read
-- Borrowers and unauthorized users should be blocked