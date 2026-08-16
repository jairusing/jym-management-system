-- Fix migration for 025: hash member PINs instead of storing them raw.
-- 025 stored the PIN as-is because rpc_set_member_pin copied p_pin into the
-- column. It also called crypt() unqualified, which fails on Supabase
-- (pgcrypto installs into the `extensions` schema). Both functions are
-- replaced with extensions-qualified crypt/gen_salt calls so the stored
-- value is always a bcrypt hash and verify works.

CREATE OR REPLACE FUNCTION public.rpc_set_member_pin(p_member_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.auth_role() NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Only staff can set member PINs.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;
  IF p_pin IS NOT NULL AND p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits.';
  END IF;
  PERFORM set_config('jms.pin_rpc', '1', true);
  UPDATE public.members
  SET pin = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now()
  WHERE id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_verify_member_pin(p_member_id UUID, p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin TEXT;
BEGIN
  IF public.auth_role() NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Only staff can verify member PINs.';
  END IF;
  SELECT pin INTO v_pin FROM public.members WHERE id = p_member_id;
  IF v_pin IS NULL THEN
    RETURN 'missing';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^\d{4,6}$' THEN
    RETURN 'fail';
  END IF;
  IF v_pin = extensions.crypt(p_pin, v_pin) THEN
    RETURN 'ok';
  END IF;
  RETURN 'fail';
END;
$$;