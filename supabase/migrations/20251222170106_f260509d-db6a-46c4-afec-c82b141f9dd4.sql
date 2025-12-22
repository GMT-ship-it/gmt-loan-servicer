-- Create projects table for Portfolio Management Dashboard
CREATE TABLE public.pmd_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create capital_providers table
CREATE TABLE public.pmd_capital_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('lender', 'investor')),
  default_interest_rate decimal NOT NULL DEFAULT 0.10,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create capital_events table
CREATE TABLE public.pmd_capital_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pmd_projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.pmd_capital_providers(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('funding_in', 'interest_payment_out', 'principal_payment_out', 'expense_out', 'adjustment')),
  amount decimal NOT NULL,
  interest_flag boolean NOT NULL DEFAULT true,
  interest_rate_override decimal,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create assets table
CREATE TABLE public.pmd_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pmd_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sale_value_assumption decimal NOT NULL DEFAULT 0,
  commission_rate decimal NOT NULL DEFAULT 0.05,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pmd_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmd_capital_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmd_capital_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmd_assets ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'owner'
      AND status = 'active'
  )
$$;

-- RLS policies for pmd_projects - owners only
CREATE POLICY "Owners can manage projects"
  ON public.pmd_projects
  FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- RLS policies for pmd_capital_providers - owners only
CREATE POLICY "Owners can manage capital providers"
  ON public.pmd_capital_providers
  FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- RLS policies for pmd_capital_events - owners only
CREATE POLICY "Owners can manage capital events"
  ON public.pmd_capital_events
  FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- RLS policies for pmd_assets - owners only
CREATE POLICY "Owners can manage assets"
  ON public.pmd_assets
  FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_pmd_capital_events_project ON public.pmd_capital_events(project_id);
CREATE INDEX idx_pmd_capital_events_provider ON public.pmd_capital_events(provider_id);
CREATE INDEX idx_pmd_capital_events_date ON public.pmd_capital_events(event_date);
CREATE INDEX idx_pmd_assets_project ON public.pmd_assets(project_id);