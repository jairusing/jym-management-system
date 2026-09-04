-- Demo owner account: superacc1@jairus.com / 0987654321
-- Created via Supabase Auth REST API (supabase/auth/v1/signup).
-- Direct SQL inserts into auth.users bypass GoTrue's internal state,
-- so this account was created through the proper Auth endpoint.
-- If re-applying, delete the existing account first.

-- Set the owner role on the profile (created by Auth REST API)
UPDATE public.profiles SET role = 'owner', name = 'Demo Owner'
WHERE email = 'superacc1@jairus.com';

-- Ensure member record exists
INSERT INTO public.members (user_id, full_name, email, phone, joined_at, is_active)
SELECT id, 'Demo Owner', 'superacc1@jairus.com', '0917 123 4567', CURRENT_DATE, true
FROM auth.users WHERE email = 'superacc1@jairus.com'
ON CONFLICT DO NOTHING;
