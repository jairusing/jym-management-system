-- The handle_new_user trigger auto-creates the profile (role 'member');
-- this upsert promotes the test account to owner so the integration suites
-- can exercise owner-only operations (member/class deletes) and staff writes.
insert into public.profiles (id, name, email, role, created_at, updated_at)
select u.id, 'JMS Test Owner', u.email, 'owner', now(), now()
from auth.users u where u.email = '[test-owner-email redacted]'
limit 1
on conflict (id) do update set role = 'owner', name = excluded.name;