-- Promote the application owner's profile to the owner role.
update public.profiles
set role = 'owner'
where email = 'jairusingente3@gmail.com';