-- Backfill: ensure every existing auth user has a public.profiles row.
-- The 003 trigger covers new signups; this heals accounts created before it,
-- or any user whose profile is missing, so template/workout inserts (which
-- FK-reference profiles(id)) never fail with workout_templates_user_id_fkey.

INSERT INTO public.profiles (id, name, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1), 'New user'),
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;