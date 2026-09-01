-- Phase 3 audit hardening: enforce business invariants at the database layer.
-- 1. rpc_record_payment(): atomic, staff-only payment + invoice + membership.
-- 2. One active membership per member (partial unique index).
-- 3. Booking capacity enforced in the database (blocks RLS-bypass).
-- 4. Members can no longer edit their own profile rows (staff/owner only).

-- ---------------------------------------------------------------------------
-- 1. Atomic staff-only payment recording
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_record_payment(
  p_invoice_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT,
  p_paid_at DATE
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET check_function_args = off
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;
  IF p_method NOT IN ('cash', 'gcash', 'card', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method.';
  END IF;
  IF public.auth_role() NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Only staff can record payments.';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;
  IF v_invoice.member_id <> p_member_id THEN
    RAISE EXCEPTION 'Invoice does not belong to this member.';
  END IF;
  IF v_invoice.status <> 'issued' THEN
    RAISE EXCEPTION 'Invoice is not payable.';
  END IF;

  INSERT INTO public.payments (invoice_id, member_id, amount, method, reference, paid_at, processed_by)
  VALUES (p_invoice_id, p_member_id, p_amount, p_method, NULLIF(p_reference, ''), p_paid_at, auth.uid())
  RETURNING * INTO v_payment;

  UPDATE public.invoices
  SET status = 'paid', paid_at = p_paid_at
  WHERE id = p_invoice_id;

  IF v_invoice.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.membership_plans WHERE id = v_invoice.plan_id;
    IF FOUND THEN
      UPDATE public.memberships
      SET status = 'expired'
      WHERE member_id = p_member_id AND status = 'active';
      INSERT INTO public.memberships (member_id, plan_id, started_at, ended_at, status)
      VALUES (p_member_id, v_invoice.plan_id, p_paid_at, p_paid_at + v_plan.duration_days, 'active');
    END IF;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. One active membership per member
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_per_member
  ON public.memberships (member_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Booking capacity enforced in the database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_class_booking_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET check_function_args = off
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_active INTEGER;
BEGIN
  SELECT capacity INTO v_capacity
  FROM public.class_sessions
  WHERE id = NEW.session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session does not exist.';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.class_bookings
  WHERE session_id = NEW.session_id
    AND status <> 'cancelled';

  IF v_active >= v_capacity THEN
    RAISE EXCEPTION 'Session is at full capacity.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_class_booking_capacity ON public.class_bookings;
CREATE TRIGGER enforce_class_booking_capacity
  BEFORE INSERT ON public.class_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_class_booking_capacity();

-- ---------------------------------------------------------------------------
-- 4. Members cannot edit their own profile rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS members_update_staff_or_self ON public.members;
CREATE POLICY members_update_staff_only ON public.members
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));