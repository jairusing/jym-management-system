-- Phase 8.6: store exact times for events that previously kept only dates.
-- 1. members.joined_at DATE -> TIMESTAMPTZ (existing rows become midnight Manila).
-- 2. invoices.issued_at / paid_at DATE -> TIMESTAMPTZ.
-- 3. rpc_record_payment() p_paid_at DATE -> TIMESTAMPTZ; membership periods stay DATE.

ALTER TABLE public.members
  ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING (joined_at::date::timestamp AT TIME ZONE 'Asia/Manila'),
  ALTER COLUMN joined_at SET DEFAULT now();

ALTER TABLE public.invoices
  ALTER COLUMN issued_at TYPE TIMESTAMPTZ USING (issued_at::date::timestamp AT TIME ZONE 'Asia/Manila'),
  ALTER COLUMN issued_at SET DEFAULT now(),
  ALTER COLUMN paid_at TYPE TIMESTAMPTZ USING (paid_at::date::timestamp AT TIME ZONE 'Asia/Manila');

DROP FUNCTION IF EXISTS public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, DATE);

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
      VALUES (p_member_id, v_invoice.plan_id, p_paid_at::date, p_paid_at::date + v_plan.duration_days, 'active');
    END IF;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;