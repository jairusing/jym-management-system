-- 043_fix_auth_role_null.sql
-- Harden auth_role() so it never returns NULL when the caller has
-- no matching public.profiles row.
--
-- Problem (Task 23/24): The original auth_role() returns NULL when
-- SELECT role FROM profiles WHERE id = auth.uid() returns zero rows.
-- Several authorization checks use auth_role() NOT IN ('owner', 'staff')
-- or auth_role() <> 'owner'. In PL/pgSQL IF, NULL evaluates to FALSE,
-- so the exception is NOT raised and the privileged operation proceeds.
--
-- Fix: Wrap the query in a scalar subquery and COALESCE the result to
-- the empty string ''. The empty string is impossible as a valid
-- profiles.role value (CHECK constraint: role IN ('owner', 'staff', 'member')),
-- so it safely fails closed in every authorization check:
--   '' NOT IN ('owner', 'staff') → TRUE → exception raised
--   '' <> 'owner'               → TRUE → exception raised
--   '' IN ('owner', 'staff')    → FALSE → access denied
--   '' = 'owner'                → FALSE → access denied
--
-- The scalar subquery is required because
-- SELECT COALESCE(role, '') FROM profiles WHERE id = X returns zero
-- rows (not a row with '') when no profile exists. COALESCE only
-- operates on values within existing rows.

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    ''
  )
$$;

-- Re-assert execute grants. CREATE OR REPLACE FUNCTION preserves
-- the function definition and security settings, but grants should
-- be explicitly verified/restored to guard against drift.
GRANT EXECUTE ON FUNCTION public.auth_role() TO anon, authenticated, service_role;
