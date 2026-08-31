-- Cadastro temporário de usuário no tenant de quem está logado.
-- Não cria agência nova: só auth.users + agency_members.

CREATE OR REPLACE FUNCTION public.list_agency_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    m.user_id,
    u.email::text,
    coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email::text),
    m.role,
    m.created_at
  FROM public.agency_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.agency_id IN (SELECT public.user_agency_ids())
  ORDER BY m.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_agency_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_agency_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_agency_user(
  p_name text,
  p_email text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_agency_id uuid;
  v_agency_name text;
  v_email text;
  v_name text;
  v_password text;
  v_user_id uuid;
BEGIN
  SELECT a.id, a.name
    INTO v_agency_id, v_agency_name
  FROM public.agency_members m
  JOIN public.agencies a ON a.id = m.agency_id
  WHERE m.user_id = auth.uid()
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Seu login não está vinculado a uma agência.';
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_password := btrim(coalesce(p_password, ''));

  IF v_email = '' OR v_password = '' OR v_name IS NULL THEN
    RAISE EXCEPTION 'Informe nome, e-mail e senha.';
  END IF;

  IF char_length(v_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Este e-mail já tem conta no MediaHub.';
  END IF;

  v_user_id := gen_random_uuid();

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
    'agency', jsonb_build_object('id', v_agency_id, 'name', v_agency_name),
    'user', jsonb_build_object(
      'user_id', v_user_id,
      'email', v_email,
      'name', v_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_agency_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agency_user(text, text, text) TO authenticated;
