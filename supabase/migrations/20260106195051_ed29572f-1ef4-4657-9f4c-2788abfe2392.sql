-- Drop and recreate the constraint to include 'funds_in'
ALTER TABLE public.fin_transactions DROP CONSTRAINT fin_transactions_type_check;

ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_type_check 
CHECK (type = ANY (ARRAY['journal'::text, 'payment'::text, 'disbursement'::text, 'accrual'::text, 'adjustment'::text, 'reversal'::text, 'funds_in'::text]));