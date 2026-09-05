-- 032_audit_cleanup.sql
-- Cleans up remaining minor audit items:
-- #5  invoices.status = 'overdue' dead enum value
-- #2  Add password change audit logging to profiles

-- ---------------------------------------------------------------------------
-- #5: Remove 'overdue' from invoices.status CHECK constraint
-- ---------------------------------------------------------------------------
-- Nothing ever sets status = 'overdue'. The is_overdue boolean handles it.
-- Fix invalid rows first, then remove 'overdue' from the CHECK constraint.

UPDATE public.invoices
SET status = 'issued'
WHERE status = 'overdue';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('issued', 'paid', 'void'));

-- ---------------------------------------------------------------------------
-- #2: Add password change audit logging to profiles
-- ---------------------------------------------------------------------------
-- Add password_changed_at column to track when passwords are changed,
-- and a trigger that logs the change to audit_log.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Backfill: set password_changed_at = created_at for existing profiles
-- (we don't know when their password was actually set; use account creation)
UPDATE public.profiles
SET password_changed_at = created_at
WHERE password_changed_at IS NULL;

CREATE OR REPLACE FUNCTION public.log_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND TG_TABLE_NAME = 'profiles'
     AND NEW.password_changed_at IS NOT NULL
     AND (OLD.password_changed_at IS NULL OR NEW.password_changed_at > OLD.password_changed_at) THEN
    INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
    VALUES ('change_password', TG_TABLE_NAME, NEW.id::TEXT,
            'full_name: ' || COALESCE(NEW.full_name, 'unknown'),
            auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_profiles_password_change ON public.profiles;
CREATE TRIGGER audit_profiles_password_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.password_changed_at IS NOT NULL AND (OLD.password_changed_at IS NULL OR NEW.password_changed_at > OLD.password_changed_at))
  EXECUTE FUNCTION public.log_password_change();
