-- C3: check-in correction. Wrong check-ins previously could not be removed
-- (check_ins_delete_none = FOR DELETE USING (false)). Allow owner/staff to
-- delete a check-in; RLS policies OR together, so members stay blocked.
CREATE POLICY check_ins_delete_staff ON public.check_ins
  FOR DELETE USING (public.auth_role() IN ('owner', 'staff'));