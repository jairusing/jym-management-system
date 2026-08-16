-- Phase 8.7 (audit fixes A1 + A2): payment money rules.
-- 1. A1: a payment must equal the invoice total exactly. No partial payments
--        or overpayments silently marking an invoice paid.
-- 2. A2: renewals extend from the CURRENT membership end date instead of
--        today, so renewing early never loses paid days. E.g. a monthly plan
--        ending Sep 15 renewed on Aug 10 now ends Oct 15 instead of Sep 9.
--        (The paid periods overlap on paper Aug 10 - Sep 15, which is the
--        standard gym convention for early renewals.)

CREATE OR REPLACE FUNCTION public.rpc_record_payment(
  p_invoice_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_active_end DATE;
  v_start DATE;
  v_end DATE;
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
  IF p_amount <> v_invoice.total THEN
    RAISE EXCEPTION 'Payment amount must equal the invoice total (%).', v_invoice.total;
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
      SELECT ended_at INTO v_active_end
      FROM public.memberships
      WHERE member_id = p_member_id AND status = 'active'
      ORDER BY ended_at DESC
      LIMIT 1;

      UPDATE public.memberships
      SET status = 'expired'
      WHERE member_id = p_member_id AND status = 'active';

      v_start := p_paid_at::date;
      v_end := v_start + v_plan.duration_days;
      IF v_active_end IS NOT NULL AND v_active_end > v_start THEN
        v_end := v_active_end + v_plan.duration_days;
      END IF;

      INSERT INTO public.memberships (member_id, plan_id, started_at, ended_at, status)
      VALUES (p_member_id, v_invoice.plan_id, v_start, v_end, 'active');
    END IF;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;