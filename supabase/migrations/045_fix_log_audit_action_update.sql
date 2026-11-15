-- 045_fix_log_audit_action_update.sql
-- Fix: log_audit_action() failed on every UPDATE to a table that has no
-- `status` column (notably public.profiles), aborting the statement with
--   42703: record "new" has no field "status"
--
-- Root cause: the UPDATE branch used flat conditions such as
--   IF TG_TABLE_NAME = 'class_bookings' AND NEW.status = 'cancelled' ...
-- PL/pgSQL does not guarantee left-to-right short-circuiting of boolean
-- expressions, so NEW.status (and OLD.role, NEW.is_active, etc.) may be
-- resolved against the firing row's record type even when the
-- TG_TABLE_NAME guard is false. A profiles UPDATE therefore raised an
-- error inside the AFTER trigger, rolling back the role change.
--
-- Fix: branch on TG_TABLE_NAME first (nested IF), so each table's
-- columns are only referenced when that trigger table is the one firing.
-- Action names, target types, and details are unchanged.

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
    IF TG_TABLE_NAME = 'class_bookings' THEN
      IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
        VALUES ('cancel_booking', TG_TABLE_NAME, NEW.id::TEXT,
                'session_id: ' || NEW.session_id::TEXT,
                auth.uid());
      ELSIF NEW.status = 'booked' AND OLD.status = 'cancelled' THEN
        INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
        VALUES ('rebook', TG_TABLE_NAME, NEW.id::TEXT,
                'session_id: ' || NEW.session_id::TEXT,
                auth.uid());
      END IF;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
        VALUES ('update_role', TG_TABLE_NAME, NEW.id::TEXT,
                'role: ' || COALESCE(OLD.role, 'NULL') || ' → ' || COALESCE(NEW.role, 'NULL'),
                auth.uid());
      END IF;
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
    ELSIF TG_TABLE_NAME = 'members' THEN
      IF NOT (NEW.is_active = false AND OLD.is_active = true) THEN
        INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
        VALUES ('update_member', TG_TABLE_NAME, NEW.id::TEXT,
                'full_name: ' || COALESCE(NEW.full_name, ''),
                auth.uid());
      END IF;
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
    ELSIF TG_TABLE_NAME = 'payments' THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('delete_payment', TG_TABLE_NAME, OLD.id::TEXT,
              'method: ' || COALESCE(OLD.method, '') || ', amount: ' || COALESCE(OLD.amount::TEXT, ''),
              auth.uid());
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
