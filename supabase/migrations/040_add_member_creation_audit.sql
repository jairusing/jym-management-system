-- 040_add_member_creation_audit.sql
-- Adds audit coverage for member creation.
-- Every successful INSERT on public.members now produces an audit_log entry
-- with action = 'create_member', correct target_type, target_id, and
-- performed_by (auth.uid()).
--
-- Uses the existing SECURITY DEFINER log_audit_action() architecture.
-- Does NOT modify log_destructive_action() (which handles members/deactivate
-- only) so no duplicate audit events are generated.
-- Does NOT create duplicate events for members.update({user_id: ...})
-- because that is an UPDATE operation, not INSERT.

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
    ELSIF TG_TABLE_NAME = 'members' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('create_member', TG_TABLE_NAME, NEW.id::TEXT,
              'full_name: ' || COALESCE(NEW.full_name, ''),
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

DROP TRIGGER IF EXISTS audit_members_insert ON public.members;
CREATE TRIGGER audit_members_insert
  AFTER INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();
