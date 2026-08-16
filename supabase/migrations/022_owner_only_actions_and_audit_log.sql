-- 022_owner_only_actions_and_audit_log.sql
-- Audit fixes E2 (owner-only void/deactivate, enforced at the DB level) and
-- D3 (minimal audit log on destructive actions, trigger-based so no client can
-- bypass it).

-- ---------------------------------------------------------------------------
-- E2: owner-only enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_owner_only_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices'
     AND NEW.status = 'void'
     AND public.auth_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can void invoices.';
  END IF;

  IF TG_TABLE_NAME = 'members'
     AND NEW.is_active = false
     AND OLD.is_active = true
     AND public.auth_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can deactivate members.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_owner_only_void ON public.invoices;
CREATE TRIGGER invoices_owner_only_void
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_only_actions();

DROP TRIGGER IF EXISTS members_owner_only_deactivate ON public.members;
CREATE TRIGGER members_owner_only_deactivate
  BEFORE UPDATE OF is_active ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_only_actions();

-- ---------------------------------------------------------------------------
-- D3: minimal audit log (who / when / what on destructive actions)
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_staff ON public.audit_log
  FOR SELECT USING (public.auth_role() IN ('owner', 'staff'));

CREATE POLICY audit_log_insert_none ON public.audit_log
  FOR INSERT WITH CHECK (false);

CREATE POLICY audit_log_update_none ON public.audit_log
  FOR UPDATE USING (false);

CREATE POLICY audit_log_delete_none ON public.audit_log
  FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.log_destructive_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (action, target_type, target_id, performed_by)
    VALUES ('delete', TG_TABLE_NAME, OLD.id::TEXT, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'invoices' AND NEW.status = 'void' THEN
    INSERT INTO public.audit_log (action, target_type, target_id, details, performed_by)
    VALUES ('void', 'invoice', NEW.id::TEXT, NEW.invoice_number, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_invoices_void ON public.invoices;
CREATE TRIGGER audit_invoices_void
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (NEW.status = 'void')
  EXECUTE FUNCTION public.log_destructive_action();

DROP TRIGGER IF EXISTS audit_members_delete ON public.members;
CREATE TRIGGER audit_members_delete
  AFTER DELETE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_destructive_action();

DROP TRIGGER IF EXISTS audit_check_ins_delete ON public.check_ins;
CREATE TRIGGER audit_check_ins_delete
  AFTER DELETE ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.log_destructive_action();