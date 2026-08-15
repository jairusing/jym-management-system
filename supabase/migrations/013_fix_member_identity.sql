-- Repair the member test account bootstrapped by 012 before the identity fix:
-- GoTrue scans auth.users token columns into strings (NULLs crash sign-in with
-- "Database error querying schema", supabase/auth#1940) and looks up password
-- users via identities.provider_id = the user UUID. Idempotent on fresh
-- environments (016 performs the same alignment for already-applied 012s).

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