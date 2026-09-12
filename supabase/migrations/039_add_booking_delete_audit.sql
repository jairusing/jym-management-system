-- 039_add_booking_delete_audit.sql
-- Adds audit coverage for actual class_bookings row deletions,
-- including cascade-deleted bookings when a class or session is deleted.
--
-- Uses the existing SECURITY DEFINER log_audit_action() architecture.
-- Does NOT modify log_destructive_action() (which handles members/check_ins
-- only) so no duplicate audit events are generated.

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
    ELSIF TG_TABLE_NAME = 'classes' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('create_class', TG_TABLE_NAME, NEW.id::TEXT,
              'name: ' || COALESCE(NEW.name, ''),
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('create_session', TG_TABLE_NAME, NEW.id::TEXT,
              'class_id: ' || NEW.class_id::TEXT,
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
    ELSIF TG_TABLE_NAME = 'classes' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('update_class', TG_TABLE_NAME, NEW.id::TEXT,
              'name: ' || COALESCE(NEW.name, ''),
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('update_session', TG_TABLE_NAME, NEW.id::TEXT,
              'class_id: ' || NEW.class_id::TEXT,
              auth.uid());
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'classes' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('delete_class', TG_TABLE_NAME, OLD.id::TEXT,
              'name: ' || COALESCE(OLD.name, ''),
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_sessions' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('delete_session', TG_TABLE_NAME, OLD.id::TEXT,
              'class_id: ' || OLD.class_id::TEXT,
              auth.uid());
    ELSIF TG_TABLE_NAME = 'class_bookings' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('delete_booking', TG_TABLE_NAME, OLD.id::TEXT,
              'session_id: ' || OLD.session_id::TEXT,
              auth.uid());
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_class_bookings_delete ON public.class_bookings;
CREATE TRIGGER audit_class_bookings_delete
  AFTER DELETE ON public.class_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();
