-- Demo owner account: Superacc1@jairus.com / 0987654321
-- Apply once via `supabase db push`. The account gets owner
-- privileges — full front-desk access plus member/role management.

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, reauthentication_token,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'Superacc1@jairus.com',
  extensions.crypt('0987654321', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  '',
  '',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'Superacc1@jairus.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id,
  u.id,
  u.id,
  'email',
   json_build_object('sub', u.id, 'email', 'Superacc1@jairus.com'),
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email = 'Superacc1@jairus.com'
  AND NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = u.id AND provider = 'email')
ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
SELECT
  u.id,
  'Demo Owner',
  'Superacc1@jairus.com',
  'owner',
  now(),
  now()
FROM auth.users u
WHERE u.email = 'Superacc1@jairus.com'
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.members (user_id, full_name, email, phone, joined_at, is_active)
SELECT
  u.id,
  'Demo Owner',
  'Superacc1@jairus.com',
  '0917 000 0000',
  CURRENT_DATE,
  true
FROM auth.users u
WHERE u.email = 'Superacc1@jairus.com'
  AND NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = u.id)
ON CONFLICT DO NOTHING;
