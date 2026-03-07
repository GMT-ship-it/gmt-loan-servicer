
-- Ledger event types
CREATE TYPE public.gmt_ledger_event_type AS ENUM (
  'capital_call',
  'distribution',
  'disbursement',
  'payment_received',
  'interest_accrual',
  'fee',
  'transfer',
  'adjustment',
  'journal'
);

-- Header table: one row per financial event
CREATE TABLE public.gmt_ledger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.gmt_entities(id),
  event_type gmt_ledger_event_type NOT NULL,
  event_date DATE NOT NULL,
  memo TEXT,
  external_ref TEXT,
  source TEXT,                -- e.g. 'manual', 'accrual_job', 'import'
  instrument_id UUID REFERENCES public.fin_instruments(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_gmt_ledger_events_updated_at
  BEFORE UPDATE ON public.gmt_ledger_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Lines table: balanced debit/credit entries per event
CREATE TABLE public.gmt_ledger_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.gmt_ledger_events(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.fin_accounts(id),
  debit NUMERIC(16,2) DEFAULT 0,
  credit NUMERIC(16,2) DEFAULT 0,
  entity_id UUID REFERENCES public.gmt_entities(id),
  counterparty_id UUID REFERENCES public.fin_counterparties(id),
  instrument_id UUID REFERENCES public.fin_instruments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positive_amounts CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT one_side_nonzero CHECK (debit > 0 OR credit > 0)
);

-- Indexes for common queries
CREATE INDEX idx_gmt_ledger_events_entity ON public.gmt_ledger_events(entity_id);
CREATE INDEX idx_gmt_ledger_events_date ON public.gmt_ledger_events(event_date);
CREATE INDEX idx_gmt_ledger_events_type ON public.gmt_ledger_events(event_type);
CREATE INDEX idx_gmt_ledger_events_instrument ON public.gmt_ledger_events(instrument_id);
CREATE INDEX idx_gmt_ledger_lines_event ON public.gmt_ledger_lines(event_id);
CREATE INDEX idx_gmt_ledger_lines_account ON public.gmt_ledger_lines(account_id);
CREATE INDEX idx_gmt_ledger_lines_instrument ON public.gmt_ledger_lines(instrument_id);

-- RLS
ALTER TABLE public.gmt_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmt_ledger_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gmt_ledger_events"
  ON public.gmt_ledger_events FOR ALL TO authenticated
  USING (public.is_admin_or_analyst(auth.uid()))
  WITH CHECK (public.is_admin_or_analyst(auth.uid()));

CREATE POLICY "Owner manage gmt_ledger_events"
  ON public.gmt_ledger_events FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Admins manage gmt_ledger_lines"
  ON public.gmt_ledger_lines FOR ALL TO authenticated
  USING (public.is_admin_or_analyst(auth.uid()))
  WITH CHECK (public.is_admin_or_analyst(auth.uid()));

CREATE POLICY "Owner manage gmt_ledger_lines"
  ON public.gmt_ledger_lines FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Balance check function: verifies debits = credits for an event
CREATE OR REPLACE FUNCTION public.gmt_ledger_balanced(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(debit), 0) = COALESCE(SUM(credit), 0)
  FROM public.gmt_ledger_lines
  WHERE event_id = p_event_id;
$$;
