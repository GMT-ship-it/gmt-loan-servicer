-- =====================================================
-- FINANCE CORE SCHEMA (prefixed with fin_)
-- =====================================================

-- 1. FIN_ENTITIES TABLE
CREATE TABLE public.fin_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_entities_name ON public.fin_entities(name);

-- 2. FIN_COUNTERPARTIES TABLE
CREATE TABLE public.fin_counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('borrower', 'lender', 'investor', 'vendor', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_counterparties_name ON public.fin_counterparties(name);
CREATE INDEX idx_fin_counterparties_type ON public.fin_counterparties(type);

-- 3. FIN_ACCOUNTS TABLE (Chart of Accounts)
CREATE TABLE public.fin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_accounts_type ON public.fin_accounts(type);
CREATE INDEX idx_fin_accounts_is_active ON public.fin_accounts(is_active);

-- 4. FIN_INSTRUMENTS TABLE
CREATE TABLE public.fin_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.fin_entities(id) ON DELETE RESTRICT,
  counterparty_id uuid NOT NULL REFERENCES public.fin_counterparties(id) ON DELETE RESTRICT,
  instrument_type text NOT NULL CHECK (instrument_type IN ('loan', 'note', 'line_of_credit', 'bond', 'other')),
  name text NOT NULL,
  principal_initial numeric NOT NULL CHECK (principal_initial >= 0),
  rate_apr numeric NOT NULL CHECK (rate_apr >= 0),
  day_count_basis text NOT NULL DEFAULT 'ACT/360' CHECK (day_count_basis IN ('ACT/360', 'ACT/365', '30/360')),
  interest_method text NOT NULL DEFAULT 'simple' CHECK (interest_method IN ('simple', 'compound')),
  start_date date NOT NULL,
  maturity_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_instruments_entity_id ON public.fin_instruments(entity_id);
CREATE INDEX idx_fin_instruments_counterparty_id ON public.fin_instruments(counterparty_id);
CREATE INDEX idx_fin_instruments_status ON public.fin_instruments(status);
CREATE INDEX idx_fin_instruments_start_date ON public.fin_instruments(start_date);
CREATE INDEX idx_fin_instruments_maturity_date ON public.fin_instruments(maturity_date);

-- 5. FIN_TRANSACTIONS TABLE
CREATE TABLE public.fin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.fin_entities(id) ON DELETE RESTRICT,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('journal', 'payment', 'disbursement', 'accrual', 'adjustment', 'reversal')),
  memo text,
  source text,
  external_ref text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_transactions_entity_id ON public.fin_transactions(entity_id);
CREATE INDEX idx_fin_transactions_date ON public.fin_transactions(date);
CREATE INDEX idx_fin_transactions_type ON public.fin_transactions(type);
CREATE INDEX idx_fin_transactions_created_by ON public.fin_transactions(created_by);

-- 6. FIN_TRANSACTION_LINES TABLE
CREATE TABLE public.fin_transaction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.fin_transactions(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.fin_accounts(id) ON DELETE RESTRICT,
  counterparty_id uuid REFERENCES public.fin_counterparties(id) ON DELETE RESTRICT,
  instrument_id uuid REFERENCES public.fin_instruments(id) ON DELETE RESTRICT,
  debit numeric CHECK (debit IS NULL OR debit > 0),
  credit numeric CHECK (credit IS NULL OR credit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_debit_xor_credit CHECK (
    (debit IS NOT NULL AND credit IS NULL) OR 
    (debit IS NULL AND credit IS NOT NULL)
  )
);

CREATE INDEX idx_fin_transaction_lines_transaction_id ON public.fin_transaction_lines(transaction_id);
CREATE INDEX idx_fin_transaction_lines_account_id ON public.fin_transaction_lines(account_id);
CREATE INDEX idx_fin_transaction_lines_counterparty_id ON public.fin_transaction_lines(counterparty_id);
CREATE INDEX idx_fin_transaction_lines_instrument_id ON public.fin_transaction_lines(instrument_id);

-- 7. FIN_INTEREST_ACCRUAL_RUNS TABLE
CREATE TABLE public.fin_interest_accrual_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_interest_accrual_runs_status ON public.fin_interest_accrual_runs(status);
CREATE INDEX idx_fin_interest_accrual_runs_run_date ON public.fin_interest_accrual_runs(run_date);

-- 8. FIN_INSTRUMENT_DAILY_POSITIONS TABLE
CREATE TABLE public.fin_instrument_daily_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.fin_instruments(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  principal_outstanding numeric NOT NULL DEFAULT 0,
  accrued_interest_balance numeric NOT NULL DEFAULT 0,
  interest_accrued_today numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fin_instrument_daily_position UNIQUE (instrument_id, as_of_date)
);

CREATE INDEX idx_fin_instrument_daily_positions_instrument_id ON public.fin_instrument_daily_positions(instrument_id);
CREATE INDEX idx_fin_instrument_daily_positions_as_of_date ON public.fin_instrument_daily_positions(as_of_date);

-- =====================================================
-- UPDATED_AT TRIGGERS (using existing handle_updated_at)
-- =====================================================

CREATE TRIGGER trg_fin_entities_updated_at BEFORE UPDATE ON public.fin_entities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fin_counterparties_updated_at BEFORE UPDATE ON public.fin_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fin_accounts_updated_at BEFORE UPDATE ON public.fin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fin_instruments_updated_at BEFORE UPDATE ON public.fin_instruments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fin_transactions_updated_at BEFORE UPDATE ON public.fin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.fin_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_interest_accrual_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_instrument_daily_positions ENABLE ROW LEVEL SECURITY;

-- FIN_ENTITIES POLICIES
CREATE POLICY "Admin full access to fin_entities"
  ON public.fin_entities FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_COUNTERPARTIES POLICIES
CREATE POLICY "Admin full access to fin_counterparties"
  ON public.fin_counterparties FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_ACCOUNTS POLICIES
CREATE POLICY "Admin full access to fin_accounts"
  ON public.fin_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_INSTRUMENTS POLICIES
CREATE POLICY "Admin full access to fin_instruments"
  ON public.fin_instruments FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_TRANSACTIONS POLICIES
CREATE POLICY "Admin full access to fin_transactions"
  ON public.fin_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_TRANSACTION_LINES POLICIES
CREATE POLICY "Admin full access to fin_transaction_lines"
  ON public.fin_transaction_lines FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_INTEREST_ACCRUAL_RUNS POLICIES
CREATE POLICY "Admin full access to fin_interest_accrual_runs"
  ON public.fin_interest_accrual_runs FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FIN_INSTRUMENT_DAILY_POSITIONS POLICIES
CREATE POLICY "Admin full access to fin_instrument_daily_positions"
  ON public.fin_instrument_daily_positions FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =====================================================
-- SEED CHART OF ACCOUNTS
-- =====================================================

INSERT INTO public.fin_accounts (name, type, is_active) VALUES
  ('Cash', 'asset', true),
  ('Notes Receivable', 'asset', true),
  ('Interest Receivable', 'asset', true),
  ('Interest Income', 'income', true),
  ('Interest Expense', 'expense', true),
  ('Equity Contributions / Funds In', 'equity', true);