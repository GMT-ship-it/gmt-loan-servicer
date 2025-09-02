-- Create a facility for the first customer so we can seed an advance
-- First, let's get a customer ID and create a facility

INSERT INTO public.facilities (customer_id, type, credit_limit, apr, min_advance)
SELECT 
  c.id,
  'revolving'::facility_type,
  500000.00,
  0.145,
  50000.00
FROM public.customers c
ORDER BY c.created_at
LIMIT 1;

-- Insert an advance transaction for the newly created facility
INSERT INTO public.transactions (facility_id, type, amount, effective_at, memo)
SELECT 
  f.id,
  'advance'::txn_type,
  100000.00,
  now() - interval '10 days',
  'Initial funding'
FROM public.facilities f
ORDER BY f.created_at DESC
LIMIT 1;