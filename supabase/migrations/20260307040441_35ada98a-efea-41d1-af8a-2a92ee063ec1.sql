
-- 1. Entity status enum
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive', 'winding_down');

-- 2. gmt_entities table
CREATE TABLE public.gmt_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  parent_entity_id UUID REFERENCES public.gmt_entities(id) ON DELETE SET NULL,
  jurisdiction TEXT,
  status entity_status NOT NULL DEFAULT 'active',
  reporting_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Updated_at trigger
CREATE TRIGGER set_gmt_entities_updated_at
  BEFORE UPDATE ON public.gmt_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS
ALTER TABLE public.gmt_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gmt_entities"
  ON public.gmt_entities
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_analyst(auth.uid()))
  WITH CHECK (public.is_admin_or_analyst(auth.uid()));

CREATE POLICY "Owner can manage gmt_entities"
  ON public.gmt_entities
  FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- 5. Seed data
INSERT INTO public.gmt_entities (id, name, short_code, jurisdiction, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'GMT Capital Group', 'GMTCG', 'US-GA', 'active');

INSERT INTO public.gmt_entities (name, short_code, parent_entity_id, jurisdiction, status) VALUES
  ('Mountain Investments', 'MTN', 'a0000000-0000-0000-0000-000000000001', 'US-GA', 'active'),
  ('uSource', 'USRC', 'a0000000-0000-0000-0000-000000000001', 'US-GA', 'active'),
  ('Meltel Consulting', 'MELT', 'a0000000-0000-0000-0000-000000000001', 'US-GA', 'active'),
  ('Onyx Meridian', 'ONYX', 'a0000000-0000-0000-0000-000000000001', 'US-GA', 'active');
