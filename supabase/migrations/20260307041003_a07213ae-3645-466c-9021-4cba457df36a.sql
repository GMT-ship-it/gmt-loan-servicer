
-- Approval request types
CREATE TYPE public.gmt_approval_request_type AS ENUM (
  'disbursement',
  'payment_received',
  'interest_payment',
  'principal_payment',
  'adjustment',
  'write_off',
  'transfer'
);

CREATE TYPE public.gmt_approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Approval requests table
CREATE TABLE public.gmt_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.gmt_entities(id),
  request_type gmt_approval_request_type NOT NULL,
  amount NUMERIC(16,2) NOT NULL,
  requested_by UUID NOT NULL,
  approved_by UUID,
  status gmt_approval_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_gmt_approval_status ON public.gmt_approval_requests(status);
CREATE INDEX idx_gmt_approval_requested_by ON public.gmt_approval_requests(requested_by);
CREATE INDEX idx_gmt_approval_entity ON public.gmt_approval_requests(entity_id);

-- RLS
ALTER TABLE public.gmt_approval_requests ENABLE ROW LEVEL SECURITY;

-- Requestors can read their own
CREATE POLICY "Users read own approval requests"
  ON public.gmt_approval_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_admin_or_analyst(auth.uid()) OR public.is_owner(auth.uid()));

-- Any authenticated user can create requests
CREATE POLICY "Users create approval requests"
  ON public.gmt_approval_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Only admin/owner can approve/reject (update)
CREATE POLICY "Approvers update approval requests"
  ON public.gmt_approval_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));
