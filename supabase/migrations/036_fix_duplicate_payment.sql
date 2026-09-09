-- 036_fix_duplicate_payment.sql
-- Prevent duplicate payments on the same invoice.
--
-- Root cause: rpc_record_payment() did not verify that an invoice
-- already has a payment row before inserting a new one. The database
-- had no unique constraint on payments(invoice_id). While the function
-- checked v_invoice.status <> 'issued', a concurrent or re-entrant call
-- could bypass this check.
--
-- Fix:
-- 1. Add a unique partial index on payments(invoice_id) where
--    invoice_id IS NOT NULL. This prevents duplicate payment rows
--    at the database level, even if the RPC function is bypassed
--    (e.g., via service_role key).
-- 2. Add an explicit EXISTS check inside rpc_record_payment() for
--    a clear error message before attempting the INSERT.
-- 3. Remove v_end / v_active_end dead code (computed but never
--    used in the membership INSERT; ended_at is always NULL).

-- ---------------------------------------------------------------------------
-- 1. Unique partial index prevents duplicate payments at the database level
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS payments_invoice_id_unique
ON public.payments (invoice_id)
WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Recreate rpc_record_payment() with duplicate check and without dead code
-- ---------------------------------------------------------------------------

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
  v_start DATE;
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

  -- Explicit check: an invoice can have only one payment through this RPC.
  -- The unique partial index on payments(invoice_id) provides a second,
  -- database-level guarantee against duplicate payments.
  IF EXISTS (SELECT 1 FROM public.payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'Invoice already has a payment.';
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
      SET status = 'expired', ended_at = p_paid_at::date
      WHERE member_id = p_member_id AND status = 'active';

      v_start := p_paid_at::date;

      INSERT INTO public.memberships (member_id, plan_id, started_at, ended_at, status)
      VALUES (p_member_id, v_invoice.plan_id, v_start, NULL, 'active');
    END IF;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
