-- 023_fix_022_trigger_functions.sql
-- Corrects two bugs in migration 022:
-- 1) PL/pgSQL does not short-circuit AND/OR: each trigger referenced fields of
--    the other table's NEW record (invoices trigger read NEW.is_active, members
--    trigger read NEW.status), raising 'record "new" has no field ...'.
--    Restructured with nested IFs so only the correct record is touched.
-- 2) The audit-log INSERT inside the trigger was subject to RLS (the
--    insert_none policy blocked it, so every member delete failed with
--    'new row violates row-level security policy for table "audit_log"').
--    The function is now SECURITY DEFINER (runs as the migration owner with
--    BYPASSRLS), so the audit trail cannot be blocked by RLS.

CREATE OR REPLACE FUNCTION public.enforce_owner_only_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.status = 'void' AND public.auth_role() <> 'owner' THEN
      RAISE EXCEPTION 'Only the owner can void invoices.';
    END IF;
  ELSIF TG_TABLE_NAME = 'members' THEN
    IF NEW.is_active = false AND OLD.is_active = true AND public.auth_role() <> 'owner' THEN
      RAISE EXCEPTION 'Only the owner can deactivate members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_destructive_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET check_function_args = off
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (action, target_type, target_id, performed_by)
    VALUES ('delete', TG_TABLE_NAME, OLD.id::TEXT, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'invoices' THEN
      IF NEW.status = 'void' THEN
        INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
        VALUES ('void', 'invoice', NEW.id::TEXT, NEW.invoice_number, auth.uid());
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;