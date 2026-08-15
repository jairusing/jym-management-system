-- Bootstrap a member-role test account for live verification of member limits:
-- rpc_record_payment() staff gate and the members_update_staff_only policy.
-- Mirrors the pattern used for the owner test account (jms.test@demo.jms).
-- Credentials: jms.member@demo.jms / Jms!Member2026

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, reauthentication_token,
  created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-1111-4222-8333-444455556666',
  'authenticated',
  'authenticated',
  'jms.member@demo.jms',
  extensions.crypt('Jms!Member2026', extensions.gen_salt('bf')),
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
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  'a1b2c3d4-1111-4222-8333-444455556666',
  'a1b2c3d4-1111-4222-8333-444455556666',
  'a1b2c3d4-1111-4222-8333-444455556666',
  'email',
  '{"sub":"a1b2c3d4-1111-4222-8333-444455556666","email":"jms.member@demo.jms"}',
  now(),
  now(),
  now()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
VALUES (
  'a1b2c3d4-1111-4222-8333-444455556666',
  'Test Member',
  'jms.member@demo.jms',
  'member',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.members (user_id, full_name, email, phone, joined_at, is_active)
VALUES (
  'a1b2c3d4-1111-4222-8333-444455556666',
  'Test Member',
  'jms.member@demo.jms',
  '0917 000 9999',
  CURRENT_DATE,
  true
)
ON CONFLICT DO NOTHING;