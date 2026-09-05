-- 030_audit_additional_triggers.sql
-- Extends the audit trail from migration 022 to cover all business actions:
-- payments, class bookings, memberships, profile changes, invoice creation, check-ins.
-- Follows the same pattern as 022/023: SECURITY DEFINER triggers
-- that cannot be bypassed by client code.

-- ---------------------------------------------------------------------------
-- New audit function: handles all non-destructive audit logging
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- payments: log when a payment is recorded
DROP TRIGGER IF EXISTS audit_payments_insert ON public.payments;
CREATE TRIGGER audit_payments_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();

-- class_bookings: log when a booking is created or cancelled
DROP TRIGGER IF EXISTS audit_class_bookings_insert ON public.class_bookings;
CREATE TRIGGER audit_class_bookings_insert
  AFTER INSERT ON public.class_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();

DROP TRIGGER IF EXISTS audit_class_bookings_update ON public.class_bookings;
CREATE TRIGGER audit_class_bookings_update
  AFTER UPDATE ON public.class_bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status <> 'cancelled')
  EXECUTE FUNCTION public.log_audit_action();

-- memberships: log when a membership is created
DROP TRIGGER IF EXISTS audit_memberships_insert ON public.memberships;
CREATE TRIGGER audit_memberships_insert
  AFTER INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();

-- invoices: log when an invoice is created
DROP TRIGGER IF EXISTS audit_invoices_insert ON public.invoices;
CREATE TRIGGER audit_invoices_insert
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();

-- check_ins: log when a check-in is recorded
DROP TRIGGER IF EXISTS audit_check_ins_insert ON public.check_ins;
CREATE TRIGGER audit_check_ins_insert
  AFTER INSERT ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_action();

-- profiles: log when a user's role changes
DROP TRIGGER IF EXISTS audit_profiles_update ON public.profiles;
CREATE TRIGGER audit_profiles_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.log_audit_action();

-- ---------------------------------------------------------------------------
-- RLS: keep audit_log read-only for staff/owner (existing policy unchanged)
-- The insert_none policy in migration 022 already blocks all direct inserts
-- because this function runs as SECURITY DEFINER (BYPASSRLS).
-- ---------------------------------------------------------------------------
