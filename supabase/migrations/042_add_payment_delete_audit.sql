-- 042_add_payment_delete_audit.sql
-- Adds audit logging for individual payment row deletions.
--
-- Payments can only be deleted through rpc_void_invoice (SECURITY DEFINER,
-- owner/staff-only) when undoing a paid invoice. This deletion was not
-- individually audited -- only the invoice-level 'undo_payment' event
-- was logged. This migration adds per-payment audit coverage.
--
-- Existing audit coverage for payments:
--   INSERT → 'payment'  (migration 030: audit_payments_insert)
--   DELETE → 'delete_payment' (this migration: audit_payments_delete)
--
-- The 'undo_payment' event from rpc_void_invoice remains intact as the
-- invoice-level event. This migration adds the row-level complement.
-- No duplicate events are created because 'undo_payment' and 'delete_payment'
-- are different actions on different target_types.
--
-- Client-side DELETE on payments is blocked by payments_delete_none RLS
-- policy (FOR DELETE USING (false)). The only DELETE path is through
-- rpc_void_invoice, which runs as SECURITY DEFINER and triggers this
-- AFTER DELETE trigger.

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

DROP TRIGGER IF EXISTS audit_payments_delete ON public.payments;
CREATE TRIGGER audit_payments_delete
  AFTER DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();
