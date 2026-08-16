-- Phase 8.x (audit fix C2): per-member check-in PIN.
-- QR codes contain only the member ID, so a screenshot of someone else's QR
-- currently lets anyone check in as that member. A 4-6 digit PIN, bcrypt-
-- hashed with pgcrypto, is verified at the front desk before the check-in is
-- recorded. The hash never leaves the database: rpc_verify_member_pin
-- answers only 'ok' | 'missing' | 'fail'.
--
-- The pin column can only be written through rpc_set_member_pin: a BEFORE
-- UPDATE trigger rejects every direct column write (this also blocks a
-- member from setting their own plaintext pin through members_update_staff_or_self),
-- and the RPC marks its own update with a transaction-local GUC flag.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS pin TEXT;

CREATE OR REPLACE FUNCTION public.members_pin_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pin IS DISTINCT FROM OLD.pin
     AND COALESCE(current_setting('jms.pin_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'Member PINs can only be set through rpc_set_member_pin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_pin_write ON public.members;
CREATE TRIGGER members_pin_write
BEFORE UPDATE OF pin ON public.members
FOR EACH ROW EXECUTE FUNCTION public.members_pin_write();

-- Owner/staff set or reset a member's PIN. p_pin NULL clears it.
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
  SET pin = p_pin, updated_at = now()
  WHERE id = p_member_id;
END;
$$;

-- Front-desk verification. 'missing' = member has no PIN (PIN is optional),
-- so the check-in may proceed without one.
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
  IF v_pin = crypt(p_pin, v_pin) THEN
    RETURN 'ok';
  END IF;
  RETURN 'fail';
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_member_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_verify_member_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_member_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_member_pin(UUID, TEXT) TO authenticated;