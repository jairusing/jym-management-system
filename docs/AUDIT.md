# Jym Management System — Thesis Adviser Audit (v1.003)

Prepared as a thesis-defense review. Every finding was checked against the
actual code, schema, and migrations. Severity: 🔴 CRITICAL · 🟠 MAJOR · 🟡 MINOR.

## A. Money & payments

- **A1 ✅ FIXED (v1.004) — Any amount marks an invoice fully paid.** Now the
  payment must equal the invoice total exactly (`rpc_record_payment` + mock +
  UI hint, migration `019`).
- **A2 ✅ FIXED (v1.004) — Renewing early loses membership days.** Renewals now
  extend from the current membership end date (migration `019`).
- **A3 ✅ FIXED (v1.007) — "Overdue" is computed client-side.** Now stored
  server-side: migration `021` adds `invoices.is_overdue`, recomputed by a
  trigger on every write to status/due_at/paid_at and backfilled. The
  repositories surface `overdue` as the status; every page (payments, ledger,
  statement) reads the stored fact. Caveat (documented in CHANGELOG): the flag
  refreshes on writes — an invoice that crosses its due date with no writes
  stays `issued` until the next write touches it.
- **A4 ✅ FIXED (v1.009) — No cash reconciliation.** Payments show who took
  the cash ("taken by <staff>"), and the Payments tab now shows per-staff
  collection totals ("today vs this month"). A formal per-shift close-out
  (shift start/end cash counts) is out of scope; the totals give the same
  reconciliation view with less ceremony.
- **A5 ✅ FIXED (v1.006) — Void is one-tap, no-reason, staff-level.** Void now
  asks for confirmation first (A5 + F1), and since v1.007 it is owner-only
  (E2). No reason field yet; recorded reasons would need a `void_reason`
  column.
- **A6 ✅ FIXED (v1.008) — Due date can be in the past; total is
  free-typed.** Plan selection prefills the price (and shows it in the
  dropdown) and sets the due date to today + plan duration; a past due date
  is rejected by the input `min` and a submit guard.
- **A7 ✅ FIXED (v1.008) — Invoice numbers are `INV-${Date.now()}`.**
  Migration `024` adds a sequence + BEFORE INSERT trigger: invoice numbers
  are now sequential `INV-YYYY-####`, seeded above the existing maximum; the
  client no longer generates them.
- **A8 ⚪ Scope decision (v1.010) — No discounts/taxes/price history.** Plan
  price changes rewrite history silently; old statements no longer match what
  was paid. Deliberately skipped: invoices already snapshot the price paid at
  invoice time, so historical totals remain correct; historical prices are not
  re-derivable from plans. Documented as a deliberate scope decision.

## B. Memberships

- **B1 ✅ FIXED (v1.005, follow-up v1.007) — Walk-in members can never get an
  account.** Members get a "Create login" action at the front desk: Vercel
  serverless function `api/create-login.ts` verifies owner/staff, creates the
  auth user with the service-role admin API (key server-side only), and links
  it to `members.user_id`. Guards: member must exist, must not already be
  linked, email must not be registered; partial failures roll back the created
  user. Since v1.007, staff can also **link an existing account** to a member
  (`api/link-account.ts` + "Link existing" in the UI) — resolving self-signup
  orphan accounts (E3).
- **B2 ✅ FIXED (v1.009) — `paused`/`cancelled` exist in types but nothing can
  set them.** The Members page now has Pause / Resume / Cancel membership
  actions (confirmations name the plan and end date); paused memberships are
  resumable, cancelled ones are final (a new payment starts a fresh
  membership). Paused/cancelled members are blocked from check-in (button
  disabled, badge shows the state, QR path refuses with a clear message).
  No schema change: `memberships_update_staff` RLS already covered the
  status update.
- **B3 ✅ FIXED (v1.008) — Deactivating a paid member blocks their check-in
  with no warning.** Deactivation now warns with the active plan and end date
  ("check-ins will be blocked immediately").
- **B4 ✅ FIXED (v1.008) — No grace period after membership expiry.** A
  3-day grace allows check-ins after expiry, with the row showing "in 3-day
  grace until …"; the hard block resumes after grace.
- **B5 🟡 — No renewal reminders anywhere** (dashboard alert deferred).

## C. Check-ins & attendance

- **C1 ✅ FIXED (v1.006) → DB-enforced (v1.037) — Duplicate check-ins possible.** A member can only
  check in once per Manila day; the repository guard (manual + QR paths)
  remains, and migration `028` closes the race window: an IMMUTABLE
  `manila_day()` helper plus a UNIQUE index on `(member_id, manila_day(checked_in_at))`
  makes the database reject concurrent duplicates (code `23505`, translated
  back to "Already checked in today." by the repository). Historical
  duplicates were collapsed keeping the earliest check-in per day.
  Live-verified by a direct-insert test that bypasses app guards.
- **C2 ✅ FIXED (v1.010) — QR is just the member ID**; a screenshot lets
  anyone check in as the member. Members can now have a 4-6 digit PIN
  (optional) set by staff; check-in (manual and QR paths) asks for it and
  rejects wrong PINs. The PIN is bcrypt-hashed server-side: migrations `025`/
  `026` add `members.pin` + `rpc_set_member_pin` (owner/staff only) and
  `rpc_verify_member_pin` (ok/missing/fail), and a BEFORE UPDATE trigger
  blocks direct writes to `members.pin` outside the RPC — no plaintext PIN can
  be stored or read (live-verified: `$2a$06$` hash prefix, direct update
  rejected).
- **C3 ✅ FIXED (v1.006) — Wrong check-ins cannot be corrected.** Migration
  `020` adds a DELETE policy on `check_ins` for owner/staff; the Today and
  History lists have a confirmed Delete button (members remain delete-blocked
  by RLS).
- **C4 🟡 → copy fixed (v1.036) — The "5 most recent" quick list is most
  recently registered, not most frequent** — regulars disappear after
  registering new walk-ins. The helper copy now truthfully says "newest
  members"; sorting by visit frequency remains future work.
- **C5 🟡 → largely addressed by display — Same-name members are
  indistinguishable** (no uniqueness, no photo). Check-in and member rows
  now show phone/email, which disambiguates same names in practice.
- **C6 🟡 → stale (seed rewritten) — Seeded rows displayed "12:00 AM"
  times** after the 018 migration. The current `006_demo_seed.sql` uses
  relative `now() - interval` timestamps; only pre-rewrite rows in an old
  live DB could still show midnight times.

## D. Data integrity

- **D1 ✅ FIXED (v1.008) — No uniqueness on member email or phone.**
  Migration `024` collapsed the existing duplicates (keeping the oldest row
  per key and re-parenting billing history; the live DB went 159 → 43
  members) and added partial unique indexes on email/phone (NULL/empty
  ignored). The UI shows friendly "already exists" messages.
- **D2 ✅ FIXED (v1.007, CASCADE disclosed v1.036) — Delete is a trap.**
  Member delete now pre-checks invoices/payments and explains why the member
  cannot be deleted (FK RESTRICT), suggesting deactivation instead; the
  delete confirmation states that record, membership, AND check-in history
  are removed permanently (the CASCADE is no longer silent). Deactivation is
  owner-only (E2).
- **D3 ✅ FIXED (v1.007) — No audit trail** for destructive actions. Migration
  `022` adds `audit_log` (RLS: owner/staff select-only) and DB triggers that
  record who/when/what for invoice voids, member deletes, and check-in deletes;
  the trigger runs `SECURITY DEFINER` (migration `023`) so no client can bypass
  or block it. A read-only Activity log page (owner/staff) displays the trail.
  Role changes and password changes are not logged (documented scope).
- **D4 ✅ FIXED (v1.036) — Statement page has no "not found/not allowed" state** for
  RLS-filtered queries. The page now renders an amber not-found notice
  ("They may have been removed, or you may not have access to their
  record") driven by the repos' 'Member not found.' throw, and load
  failures show the amber LoadError panel with human copy — the previous
  silent mock-data fallback is removed.
- **D5 🟡 — All lists fetched client-side in full**; pagination is client-side
  only (scalability boundary at scale).

## E. Security & auth

- **E1 🟠 → documented scope decision (clarified 2026-08-21) — Password
  policy is Supabase's 6-char minimum**; no rotation, no true 2FA. What DOES
  exist: an email-confirmation flow on signup ("Check your email") — a
  one-time verification, not per-login second-factor; there is no MFA/factor
  code in the app. Any additional email step would come from Supabase
  dashboard settings. Accepted for thesis scope; revisit if a real gym
  onboards (Supabase supports phone/email OTP factors if ever needed).
- **E2 ✅ FIXED (v1.007) → refined (v1.020) — Control matrix too permissive
  / too strict: staff can void, and no way to undo a wrong payment.** Migration
  `022` made void owner-only via DB triggers; migration `027` (v1.020) relaxes
  that: owner OR staff may void an `issued` invoice (trigger + audit log), and
  the owner-only `rpc_void_invoice` undoes a payment on a `paid` invoice —
  payment rows are deleted and the invoice returns to `issued` (no direct
  paid→void update is possible, so money can't be written off on the books).
  Staff still cannot deactivate members (owner-only trigger).
- **E3 🟡 → mostly fixed (v1.007) — Self-signup orphans pollute
  profiles/staff list.** Staff can now link an orphan account to a member via
  "Link existing" (api/link-account.ts). Orphans that are never linked still
  appear in the staff list.
- **E4 ✅ — RLS is genuinely strong**: staff-gated payment RPC (live-tested),
  members cannot edit own rows, ledger delete-none. Defend this.

## F. UI/UX

- **F1 🟡 → mostly fixed (v1.006)** — Void and Deactivate now confirm first;
  the shared error/success state with no auto-dismiss remains (F2).
- **F2 🟡 — Single shared error/success state; no auto-dismiss.**
- **F3 ✅ FIXED (v1.036) — Header no longer says "Beta"**; the Profile page
  version indicator is the single source of truth for release status.
- **F4 🟡 — Version format 1.001 is not semver.**

## G. Feature-level gaps (document as deliberate "future work")

1. No recurring billing / renewal reminders — every renewal invoice is manual.
2. Member self-service unreachable (B1).
3. No analytics (attendance rate, retention, churn, revenue-per-member).
4. No receipts.
5. No backup/export story in the app (attendance CSV only).

## Defensible strengths

- Database-enforced invariants: atomic payment RPC, one-active-membership,
  class capacity trigger — proven by live tests.
- RLS security boundary proven by member-limits integration tests.
- Manila timezone correctness end-to-end (CSVs included).
- 234 tests / 34 files (v1.010), green, including live DB proofs for the
  uniqueness indexes, the owner-only triggers, the audit trail, the
  sequential invoice numbers, the pause/resume/cancel membership
  sequence, and the hashed member-PIN set/verify/clear sequence.
- Phase-8 counter UX is genuinely front-desk-ready.

## Recommended fix order

1. **A1** — payment amount must equal invoice total (or true partials).
2. **A2** — renewals extend from current membership end, not today.
3. **B1 ✅ FIXED (v1.005)** — "Create login for member" flow in the UI.
4. **A5/C1/C3 ✅ FIXED (v1.006)** — confirm on void; duplicate check-in guard;
   check-in correction path.
5. **A3 ✅ FIXED (v1.007)** — overdue stored in the DB, not per-browser.
6. **D2/D3 ✅ FIXED (v1.007)** — delete failures explained; trigger-based audit
   log + Activity log page.
7. **E2 ✅ FIXED (v1.007)** — void + deactivate are owner-only (DB-enforced).
8. **A6/B3/B4 ✅ FIXED (v1.008)** — due-date validation + plan prefill;
   deactivation warning; 3-day expiry grace.
9. **D1/A7 ✅ FIXED (v1.008)** — member email/phone uniqueness (DB-enforced);
   sequential invoice numbers (DB-generated).
10. **B2/A4 ✅ FIXED (v1.009)** — pause/resume/cancel membership flow;
    per-staff collection totals.
11. **C2 ✅ FIXED (v1.010)** — member check-in PINs, bcrypt-hashed in the DB
    (migrations `025`/`026`); A8 (price history) declared a scope decision.
12. Everything else → document as deliberate scope decisions in the thesis.