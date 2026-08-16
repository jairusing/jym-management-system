-- 021_invoice_overdue_flag.sql
-- Audit fix A3: "overdue" must be a stored server-side fact, not per-browser math.
-- The flag is recomputed on every write to status / due_at / paid_at; a no-write
-- day can leave it stale (documented in CHANGELOG).

ALTER TABLE public.invoices
  ADD COLUMN is_overdue BOOLEAN NOT NULL DEFAULT false;

UPDATE public.invoices
SET is_overdue = (
  status = 'issued'
  AND due_at IS NOT NULL
  AND due_at < (now() AT TIME ZONE 'Asia/Manila')::date
);

CREATE OR REPLACE FUNCTION public.set_invoice_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_overdue := (
    NEW.status = 'issued'
    AND NEW.due_at IS NOT NULL
    AND NEW.due_at < (now() AT TIME ZONE 'Asia/Manila')::date
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_set_overdue ON public.invoices;
CREATE TRIGGER invoices_set_overdue
  BEFORE INSERT OR UPDATE OF status, due_at, paid_at ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_overdue();