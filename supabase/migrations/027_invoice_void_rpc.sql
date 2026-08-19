-- 027_invoice_void_rpc.sql
-- Critique round 5 (P1, user-approved 2026-08-19): staff can now void issued
-- invoices, and the owner can undo a wrong payment on a paid invoice.
--
-- 1) The owner-only trigger relaxes: owner OR staff may set an ISSUED invoice
--    to 'void' (staff previously had no void path at all). Everything else
--    (paid -> void, void -> void) is blocked for direct updates: a paid
--    invoice may only move back through rpc_void_invoice, which also removes
--    the payment rows — a direct paid->void update would leave the money on
--    the books.
-- 2) rpc_void_invoice:
--      - issued invoice: void it (owner or staff). The existing
--        audit_invoices_void trigger logs the 'void' row.
--      - paid invoice: owner only. Deletes the payment rows, returns the
--        invoice to 'issued' (paid_at cleared) so the payment can be
--        recorded again, and logs 'undo_payment' in audit_log.

CREATE OR REPLACE FUNCTION public.enforce_owner_only_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.status = 'void' THEN
      IF public.auth_role() NOT IN ('owner', 'staff') THEN
        RAISE EXCEPTION 'Only staff can void invoices.';
      END IF;
      IF OLD.status <> 'issued' THEN
        RAISE EXCEPTION 'Only the owner can undo a paid invoice through rpc_void_invoice.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'members' THEN
    IF NEW.is_active = false AND OLD.is_active = true AND public.auth_role() <> 'owner' THEN
      RAISE EXCEPTION 'Only the owner can deactivate members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_void_invoice(p_invoice_id UUID)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  IF public.auth_role() NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Only staff can void invoices.';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;
  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'Invoice is already void.';
  END IF;

  IF v_invoice.status = 'paid' THEN
    IF public.auth_role() <> 'owner' THEN
      RAISE EXCEPTION 'Only the owner can undo a paid invoice.';
    END IF;
    DELETE FROM public.payments WHERE invoice_id = p_invoice_id;
    UPDATE public.invoices
    SET status = 'issued', paid_at = NULL
    WHERE id = p_invoice_id;
    INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
    VALUES ('undo_payment', 'invoice', p_invoice_id::TEXT, v_invoice.invoice_number, auth.uid());
  ELSE
    UPDATE public.invoices
    SET status = 'void'
    WHERE id = p_invoice_id;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_void_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_void_invoice(UUID) TO authenticated;
