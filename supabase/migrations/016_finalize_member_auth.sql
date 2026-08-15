-- Finalize the member test account's auth rows: GoTrue scans the auth.users
-- token columns into strings, so any NULL crashes sign-in with
-- "Database error querying schema" (see supabase/auth#1940). Mirror the
-- GoTrue-created shape (jms.test@demo.jms) exactly and remove the probe clone.

UPDATE auth.users
SET confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    raw_user_meta_data = '{}'
WHERE id = 'a1b2c3d4-1111-4222-8333-444455556666';

UPDATE auth.identities
SET provider_id = 'a1b2c3d4-1111-4222-8333-444455556666',
    identity_data = '{"sub":"a1b2c3d4-1111-4222-8333-444455556666","email":"jms.member@demo.jms"}'
WHERE user_id = 'a1b2c3d4-1111-4222-8333-444455556666'
  AND provider = 'email';

DELETE FROM public.profiles WHERE id = 'a1b2c3d4-2222-4222-8333-444455556666';
DELETE FROM auth.identities WHERE user_id = 'a1b2c3d4-2222-4222-8333-444455556666';
DELETE FROM auth.users WHERE id = 'a1b2c3d4-2222-4222-8333-444455556666';