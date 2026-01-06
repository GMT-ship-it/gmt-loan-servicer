-- Add position column to fin_instruments
ALTER TABLE public.fin_instruments
ADD COLUMN position text NOT NULL DEFAULT 'receivable'
CHECK (position IN ('receivable', 'payable'));

-- Add Notes Payable account if not exists
INSERT INTO public.fin_accounts (name, type)
SELECT 'Notes Payable', 'liability'
WHERE NOT EXISTS (SELECT 1 FROM public.fin_accounts WHERE name = 'Notes Payable');

-- Add Interest Payable account if not exists
INSERT INTO public.fin_accounts (name, type)
SELECT 'Interest Payable', 'liability'
WHERE NOT EXISTS (SELECT 1 FROM public.fin_accounts WHERE name = 'Interest Payable');