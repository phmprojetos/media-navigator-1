-- Onboarding de agência + operação (tenant platform).

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'active'
    CHECK (onboarding_status IN ('pending', 'active')),
  ADD COLUMN IF NOT EXISTS is_platform BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_email TEXT;

UPDATE public.agencies
SET is_platform = true, onboarding_status = 'active'
WHERE id = 'a0000000-0000-4000-8000-000000000001';

CREATE OR REPLACE FUNCTION public.is_platform_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_members m
    JOIN public.agencies a ON a.id = m.agency_id
    WHERE m.user_id = auth.uid()
      AND a.is_platform = true
  );
$$;

DROP POLICY IF EXISTS "agencies_select_member" ON public.agencies;
CREATE POLICY "agencies_select_member" ON public.agencies
  FOR SELECT USING (
    id IN (SELECT public.user_agency_ids())
    OR public.is_platform_ops()
  );

DROP POLICY IF EXISTS "agencies_update_member" ON public.agencies;
CREATE POLICY "agencies_update_member" ON public.agencies
  FOR UPDATE USING (id IN (SELECT public.user_agency_ids()))
  WITH CHECK (id IN (SELECT public.user_agency_ids()));

GRANT EXECUTE ON FUNCTION public.is_platform_ops() TO authenticated;

-- Provisiona tenant + admin (chamado pelo painel da operação).
CREATE OR REPLACE FUNCTION public.provision_agency(
  p_agency_name text,
  p_admin_email text,
  p_admin_name text DEFAULT NULL,
  p_admin_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_slug text;
  v_password text;
  v_agency_id uuid;
  v_user_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF NOT public.is_platform_ops() THEN
    RAISE EXCEPTION 'Apenas a operação da plataforma pode provisionar agências.';
  END IF;

  v_email := lower(btrim(coalesce(p_admin_email, '')));
  IF btrim(coalesce(p_agency_name, '')) = '' OR v_email = '' THEN
    RAISE EXCEPTION 'Informe o nome da agência e o e-mail do admin.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Este e-mail já tem conta no MediaHub.';
  END IF;

  v_name := coalesce(nullif(btrim(p_admin_name), ''), btrim(p_agency_name));
  v_slug := trim(both '-' FROM regexp_replace(lower(btrim(p_agency_name)), '[^a-z0-9]+', '-', 'g'));
  IF v_slug = '' THEN
    v_slug := 'agencia';
  END IF;
  v_slug := left(v_slug, 40);
  IF EXISTS (SELECT 1 FROM public.agencies WHERE slug = v_slug) THEN
    v_slug := left(v_slug, 33) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;

  v_password := coalesce(nullif(btrim(p_admin_password), ''), encode(gen_random_bytes(9), 'base64'));
  v_user_id := gen_random_uuid();

  INSERT INTO public.agencies (name, slug, onboarding_status, is_platform, admin_email)
  VALUES (btrim(p_agency_name), v_slug, 'pending', false, v_email)
  RETURNING id INTO v_agency_id;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    coalesce((SELECT id FROM auth.instances LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid),
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_email,
    now(),
    now(),
    now()
  );

  INSERT INTO public.agency_members (agency_id, user_id, role)
  VALUES (v_agency_id, v_user_id, 'admin');

  RETURN jsonb_build_object(
    'ok', true,
    'agency', jsonb_build_object(
      'id', v_agency_id,
      'name', btrim(p_agency_name),
      'slug', v_slug,
      'onboarding_status', 'pending',
      'admin_email', v_email
    ),
    'admin', jsonb_build_object(
      'user_id', v_user_id,
      'email', v_email,
      'name', v_name,
      'temporary_password', v_password
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_agency(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_agency(text, text, text, text) TO authenticated;
