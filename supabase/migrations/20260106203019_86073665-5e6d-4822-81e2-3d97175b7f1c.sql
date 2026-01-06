-- Add unique constraint on fin_accounts.name if not exists
ALTER TABLE public.fin_accounts ADD CONSTRAINT fin_accounts_name_key UNIQUE (name);

-- Insert required accounts (idempotent)
INSERT INTO public.fin_accounts (name, type) VALUES
  ('Notes Receivable', 'asset'),
  ('Notes Payable', 'liability'),
  ('Interest Receivable', 'asset'),
  ('Interest Payable', 'liability'),
  ('Interest Income', 'income'),
  ('Interest Expense', 'expense'),
  ('Cash', 'asset')
ON CONFLICT (name) DO NOTHING;