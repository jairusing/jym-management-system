-- 037_fix_booking_rebook_audit.sql
-- Fixes audit gap: cancelled → booked rebooking was not creating an audit entry.
--
-- Root cause: audit_class_bookings_update trigger only fired when
-- NEW.status = 'cancelled' AND OLD.status <> 'cancelled'.
-- It did not fire when a cancelled booking was rebooked (status changed to 'booked').
--
-- Fix: Extend log_audit_action() to handle the rebooking case,
-- and update the trigger condition to also fire on cancelled → booked.

CREATE OR REPLACE FUNCTION public.log_audit_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'payments' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('payment', TG_TABLE_NAME, NEW.id::TEXT,
              'method: ' || COALESCE(NEW.method, '') || ', amount: ' || COALESCE(NEW.amount::TEXT, ''),
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_bookings' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('book', TG_TABLE_NAME, NEW.id::TEXT,
              'session_id: ' || NEW.session_id::TEXT,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'memberships' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('create_membership', TG_TABLE_NAME, NEW.id::TEXT,
              'plan_id: ' || NEW.plan_id::TEXT,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('create_invoice', TG_TABLE_NAME, NEW.id::TEXT,
              'invoice_number: ' || NEW.invoice_number,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'check_ins' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('check_in', TG_TABLE_NAME, NEW.id::TEXT,
              'method: ' || COALESCE(NEW.method, 'manual'),
              auth.uid());
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'class_bookings' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('cancel_booking', TG_TABLE_NAME, NEW.id::TEXT,
              'session_id: ' || NEW.session_id::TEXT,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_bookings' AND NEW.status = 'booked' AND OLD.status = 'cancelled' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('rebook', TG_TABLE_NAME, NEW.id::TEXT,
              'session_id: ' || NEW.session_id::TEXT,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'profiles' AND OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('update_role', TG_TABLE_NAME, NEW.id::TEXT,
              'role: ' || COALESCE(OLD.role, 'NULL') || ' → ' || COALESCE(NEW.role, 'NULL'),
              auth.uid());
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_class_bookings_update ON public.class_bookings;
CREATE TRIGGER audit_class_bookings_update
  AFTER UPDATE ON public.class_bookings
  FOR EACH ROW
  WHEN (
    (NEW.status = 'cancelled' AND OLD.status <> 'cancelled')
    OR (NEW.status = 'booked' AND OLD.status = 'cancelled')
  )
  EXECUTE FUNCTION public.log_audit_action();
