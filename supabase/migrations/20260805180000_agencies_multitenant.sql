-- Multi-tenant: agências (empresas usuárias do MediaHub)
-- Clientes de mídia e conexões de ads pertencem à agência, não ao app global.

-- ═══════════════════════════════════════════════════════════
-- AGENCIES
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agency_members (
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_user ON public.agency_members (user_id);

ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

-- Helper: agências do usuário autenticado
CREATE OR REPLACE FUNCTION public.user_agency_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid();
$$;

-- ═══════════════════════════════════════════════════════════
-- CLIENTS → agency
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'cnpj'
    CHECK (document_type IN ('cnpj', 'cpf', 'foreign', 'other'));

ALTER TABLE public.clients
  ALTER COLUMN cnpj DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_agency ON public.clients (agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_agency_cnpj
  ON public.clients (agency_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

-- ═══════════════════════════════════════════════════════════
-- PLATFORM CONNECTIONS → agency + optional client link
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.platform_connections
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

ALTER TABLE public.platform_connections
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_connections_agency
  ON public.platform_connections (agency_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_client
  ON public.platform_connections (client_id);

-- ═══════════════════════════════════════════════════════════
-- FUNNEL RECORDS → agency (opcional, para isolamento futuro)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.funnel_daily_records
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_funnel_daily_agency
  ON public.funnel_daily_records (agency_id);

-- ═══════════════════════════════════════════════════════════
-- BOOTSTRAP: agência Redmedia + todos os users atuais
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.agencies (id, name, slug)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Redmedia', 'redmedia')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.agency_members (agency_id, user_id, role)
SELECT 'a0000000-0000-4000-8000-000000000001', id, 'admin'
FROM auth.users
ON CONFLICT DO NOTHING;

UPDATE public.clients
SET agency_id = 'a0000000-0000-4000-8000-000000000001'
WHERE agency_id IS NULL;

UPDATE public.platform_connections
SET agency_id = 'a0000000-0000-4000-8000-000000000001'
WHERE agency_id IS NULL;

UPDATE public.funnel_daily_records
SET agency_id = 'a0000000-0000-4000-8000-000000000001'
WHERE agency_id IS NULL;

-- ═══════════════════════════════════════════════════════════
-- RLS: isolar por agência
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Leitura pública de clients" ON public.clients;
DROP POLICY IF EXISTS "Inserção de clients" ON public.clients;
DROP POLICY IF EXISTS "Atualização de clients" ON public.clients;
DROP POLICY IF EXISTS "Deleção de clients" ON public.clients;

CREATE POLICY "clients_select_agency" ON public.clients
  FOR SELECT USING (agency_id IN (SELECT public.user_agency_ids()));
CREATE POLICY "clients_insert_agency" ON public.clients
  FOR INSERT WITH CHECK (agency_id IN (SELECT public.user_agency_ids()));
CREATE POLICY "clients_update_agency" ON public.clients
  FOR UPDATE USING (agency_id IN (SELECT public.user_agency_ids()));
CREATE POLICY "clients_delete_agency" ON public.clients
  FOR DELETE USING (agency_id IN (SELECT public.user_agency_ids()));

DROP POLICY IF EXISTS "Usuarios gerenciam suas proprias conexoes" ON public.platform_connections;
CREATE POLICY "connections_select_agency" ON public.platform_connections
  FOR SELECT USING (
    agency_id IN (SELECT public.user_agency_ids())
    OR user_id = auth.uid()
  );
CREATE POLICY "connections_insert_agency" ON public.platform_connections
  FOR INSERT WITH CHECK (
    agency_id IN (SELECT public.user_agency_ids())
    OR user_id = auth.uid()
  );
CREATE POLICY "connections_update_agency" ON public.platform_connections
  FOR UPDATE USING (
    agency_id IN (SELECT public.user_agency_ids())
    OR user_id = auth.uid()
  );
CREATE POLICY "connections_delete_agency" ON public.platform_connections
  FOR DELETE USING (
    agency_id IN (SELECT public.user_agency_ids())
    OR user_id = auth.uid()
  );

CREATE POLICY "agencies_select_member" ON public.agencies
  FOR SELECT USING (id IN (SELECT public.user_agency_ids()));

CREATE POLICY "agency_members_select_own" ON public.agency_members
  FOR SELECT USING (user_id = auth.uid() OR agency_id IN (SELECT public.user_agency_ids()));

DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
