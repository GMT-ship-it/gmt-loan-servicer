-- Create a dedicated table to track accrual postings (hard duplicate prevention)
CREATE TABLE IF NOT EXISTS public.fin_accrual_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_id UUID NOT NULL REFERENCES public.fin_instruments(id) ON DELETE CASCADE,
  accrual_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.fin_transactions(id) ON DELETE SET NULL,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fin_accrual_postings_unique UNIQUE (instrument_id, accrual_date)
);

-- Enable RLS
ALTER TABLE public.fin_accrual_postings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write (admin context)
CREATE POLICY "Allow authenticated users full access to fin_accrual_postings"
  ON public.fin_accrual_postings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also ensure fin_instrument_daily_positions has unique constraint (for upsert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fin_instrument_daily_positions_instrument_date_key'
  ) THEN
    ALTER TABLE public.fin_instrument_daily_positions 
    ADD CONSTRAINT fin_instrument_daily_positions_instrument_date_key 
    UNIQUE (instrument_id, as_of_date);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fin_accrual_postings_instrument_date 
  ON public.fin_accrual_postings(instrument_id, accrual_date);