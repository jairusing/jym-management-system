-- C1 (audit): close the duplicate-check-in race window.
-- The repository pre-checked duplicates in application code, but two
-- concurrent requests could both pass that check and both insert. This
-- migration enforces one check-in per member per Manila day inside the
-- database itself, matching the rule the UI already promises.

-- AT TIME ZONE with a constant zone is marked STABLE by Postgres (timezone
-- rules are mutable), which disqualifies it from index expressions. The
-- Philippines does not observe DST, so wrapping it as IMMUTABLE is safe and
-- lets the unique index use Manila-day boundaries.
CREATE OR REPLACE FUNCTION public.manila_day(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ts AT TIME ZONE 'Asia/Manila')::date;
$$;

-- Collapse any historical duplicates before adding the constraint, keeping
-- the EARLIEST check-in of each member/Manila-day pair (row-comparison also
-- removes exact-timestamp ties deterministically).
-- NOTE: the check-ins DELETE trigger writes to audit_log; this migration may
-- append one audit row per removed duplicate.
DELETE FROM public.check_ins a
USING public.check_ins b
WHERE a.member_id = b.member_id
  AND public.manila_day(a.checked_in_at) = public.manila_day(b.checked_in_at)
  AND (a.checked_in_at, a.id) > (b.checked_in_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS check_ins_member_manila_day_unique
  ON public.check_ins (member_id, public.manila_day(checked_in_at));
