-- 033_fix_profile_role_escalation.sql
-- Prevent non-owners from changing the profiles.role column via direct UPDATE.
-- The existing RLS policies (profiles_update_self, profiles_update_role_owner)
-- are left unchanged. A BEFORE UPDATE trigger enforces the role-change restriction.
--
-- The vulnerability: profiles_update_self allows any user to update their own
-- profile row without column restrictions. Combined with PostgreSQL RLS OR
-- behavior (any policy permitting the operation allows it), a member or staff
-- can update their own profiles.role to 'owner' because profiles_update_self
-- matches (id = auth.uid()) and profiles_update_role_owner does not block it
-- (auth.role() returns the pre-update role, which is not 'owner').
--
-- Fix: A BEFORE UPDATE trigger on profiles checks if the role column is being
-- changed. If so, only owners are allowed to proceed.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET searchPath = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.role IS DISTINCT FROM OLD.role
     AND public.auth_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change profile roles.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_change();
