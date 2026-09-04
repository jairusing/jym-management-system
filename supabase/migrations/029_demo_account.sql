-- Demo owner account: Superacc1@jairus.com / 0987654321
-- Apply once via `supabase db push`. The account gets owner
-- privileges — full front-desk access plus member/role management.

DO $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'Superacc1@jairus.com') THEN
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, reauthentication_token, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'Superacc1@jairus.com',
      extensions.crypt('0987654321', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NULL, NULL, NULL, NULL, NULL, NULL,
      now(), now()
    RETURNING id INTO v_id;
  ELSE
    SELECT id INTO v_id FROM auth.users WHERE email = 'Superacc1@jairus.com';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = v_id::text AND provider = 'email') THEN
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (v_id, v_id, v_id::text, 'email', json_build_object('sub', v_id, 'email', 'Superacc1@jairus.com'), now(), now(), now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_id) THEN
    INSERT INTO public.profiles (id, name, email, role, created_at, updated_at) VALUES (v_id, 'Demo Owner', 'Superacc1@jairus.com', 'owner', now(), now());
  ELSE
    UPDATE public.profiles SET role = 'owner', name = 'Demo Owner', email = 'Superacc1@jairus.com' WHERE id = v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = v_id) THEN
    INSERT INTO public.members (user_id, full_name, email, phone, joined_at, is_active) VALUES (v_id, 'Demo Owner', 'Superacc1@jairus.com', '0917 123 4567', CURRENT_DATE, true);
  END IF;
END $$;
