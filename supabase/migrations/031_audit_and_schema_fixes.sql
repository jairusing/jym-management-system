-- 031_audit_and_schema_fixes.sql
-- Fixes remaining minor audit/schema items:
-- #8  class_bookings missing updated_at
-- #9  class_bookings unique constraint blocks re-booking
-- #11 audit_log does not capture member deactivation
-- #13 memberships.status not enforced against ended_at

-- ---------------------------------------------------------------------------
-- #8: class_bookings missing updated_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows
UPDATE public.class_bookings
SET updated_at = now()
WHERE updated_at IS NULL;

-- Generic handle_updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_class_bookings_updated ON public.class_bookings;
CREATE TRIGGER handle_class_bookings_updated
  BEFORE UPDATE ON public.class_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- #9: class_bookings unique constraint blocks re-booking
-- ---------------------------------------------------------------------------
-- The UNIQUE (session_id, member_id) constraint prevents a member from
-- re-booking a session they previously cancelled. Replace it with a
-- partial unique index that only enforces uniqueness for non-cancelled
-- bookings, allowing re-booking after cancellation.

ALTER TABLE public.class_bookings
  DROP CONSTRAINT IF EXISTS class_bookings_session_id_member_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS class_bookings_unique_active
  ON public.class_bookings (session_id, member_id)
  WHERE status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- #11: audit_log does not capture member deactivation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_member_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND TG_TABLE_NAME = 'members'
     AND NEW.is_active = false
     AND OLD.is_active = true THEN
    INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
    VALUES ('deactivate', TG_TABLE_NAME, NEW.id::TEXT,
            'full_name: ' || COALESCE(NEW.full_name, 'unknown'),
            auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_members_deactivate ON public.members;
CREATE TRIGGER audit_members_deactivate
  AFTER UPDATE ON public.members
  FOR EACH ROW
  WHEN (NEW.is_active = false AND OLD.is_active = true)
  EXECUTE FUNCTION public.log_member_deactivation();

-- ---------------------------------------------------------------------------
-- #13: memberships.status not enforced against ended_at
-- ---------------------------------------------------------------------------
-- When ended_at is set, status must be 'expired'.
-- When status is 'expired', ended_at must be set.

-- Fix invalid rows first: if ended_at is set but status is not 'expired', set status to 'expired'
UPDATE public.memberships
SET status = 'expired'
WHERE ended_at IS NOT NULL AND status <> 'expired';

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_status_ended_at_check;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_status_ended_at_check
  CHECK (
    (ended_at IS NOT NULL AND status = 'expired') OR
    (ended_at IS NULL AND status <> 'expired')
  );
