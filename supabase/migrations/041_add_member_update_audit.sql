-- 041_add_member_update_audit.sql
-- Adds audit logging for ordinary updates to existing member rows.
--
-- Existing member lifecycle audit coverage:
--   INSERT  → create_member  (migration 040: audit_members_insert)
--   UPDATE  → update_member  (this migration: audit_members_update)
--   deactivate → deactivate  (migration 031: audit_members_deactivate)
--   DELETE  → delete         (migration 022: log_destructive_action)
--
-- The audit_members_update trigger fires for ALL member UPDATE operations
-- EXCEPT when is_active changes from true to false. That case is handled
-- exclusively by audit_members_deactivate (migration 031), which produces
-- action = 'deactivate'. This prevents duplicate update_member + deactivate
-- events for the same deactivation operation.
--
-- Sensitive fields (pin) are never included in audit_log.details.
-- The members_pin_write BEFORE trigger blocks direct pin writes, so
-- pin changes always go through rpc_set_member_pin, which uses a
-- transaction-local GUC flag (jms.pin_rpc) to mark the update.
-- The details field records only full_name as context, never the PIN.

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
    ELSIF TG_TABLE_NAME = 'members' AND NOT (NEW.is_active = false AND OLD.is_active = true) THEN
      INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
      VALUES ('update_member', TG_TABLE_NAME, NEW.id::TEXT,
              'full_name: ' || COALESCE(NEW.full_name, ''),
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

DROP TRIGGER IF EXISTS audit_members_update ON public.members;
CREATE TRIGGER audit_members_update
  AFTER UPDATE ON public.members
  FOR EACH ROW
  WHEN (NOT (NEW.is_active = false AND OLD.is_active = true))
  EXECUTE FUNCTION public.log_audit_action();
