-- 044_harden_profiles_insert_self.sql
-- Defense-in-depth: restrict profiles_insert_self so authenticated users
-- can only self-insert as 'member'.
--
-- Context (Task 27): profiles_insert_self previously allowed any role:
--   WITH CHECK (id = auth.uid())
-- This meant an authenticated user could insert their own profile with
-- role = 'owner' or role = 'staff' if their profile row did not already
-- exist. The missing-profile state is not reachable through normal
-- authenticated client operations (profiles_delete_none blocks DELETEs,
-- handle_new_user() creates profiles atomically, PRIMARY KEY prevents
-- duplicates). However, this migration hardens the policy as defense-in-
-- depth so that even if an orphaned profile state were reached, the user
-- could not self-insert as a privileged role.
--
-- The policy name and authenticated-user behavior are preserved.

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND role = 'member'
);
