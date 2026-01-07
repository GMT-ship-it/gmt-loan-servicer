-- Update fin_transactions type constraint to allow 'disbursement'
-- (Keeps existing allowed values and adds 'disbursement')
ALTER TABLE public.fin_transactions
DROP CONSTRAINT IF EXISTS fin_transactions_type_check;

ALTER TABLE public.fin_transactions
ADD CONSTRAINT fin_transactions_type_check
CHECK (
  type = ANY (
    ARRAY[
      'journal'::text,
      'accrual'::text,
      'funds_in'::text,
      'funds_used'::text,
      'interest_paid'::text,
      'principal_payment'::text,
      'payment_received'::text,
      'disbursement'::text
    ]
  )
);
