# Changelog

All shipped changes are tracked here with a version number. The version shown on the
Profile page (and in `apps/web/package.json`) always matches the latest entry below.
Every time a change ships, the version bumps (1.001 → 1.002 → 1.003, …) and a new
entry is added at the top of this file.

## v1.014 — Critique round 6: check-in feedback, PIN panel, confirmable delete (2026-08-17)

- Success and error feedback are announced: the success banner is a
  `role="status"` live region and errors are `role="alert"` — screen readers
  hear check-in results instead of silent top-of-page text.
- After a member checks in, their row in the member list immediately
  disables and relabels to "Checked in today", so the outcome is visible at
  the action instead of only in a banner; a re-check attempt is blocked
  before any repo call, including the QR path ("already checked in today").
- The PIN panel now appears at the bottom of the check-in card — next to the
  member list the user is working in — instead of above the search form;
  the PIN input autofocuses and the panel scrolls into view, and the input
  is `type="password"` (shared front-desk machines).
- Check-in deletion uses the ConfirmModal (danger variant, "Deleting…"
  pending label, in-dialog errors, success message "Check-in deleted.")
  instead of `window.confirm`.
- Verified: full suite 246/246 (34 files, live DB tests included);

## v1.013 — Critique rounds 2-5: modal lifecycle, honest statuses, menu & keyboard fixes (2026-08-17)

- ConfirmModal stays open while the operation runs: buttons disable with a
  "Deleting…"/"Pausing…" pending label, it closes only on success, and
  failures render inside the dialog (`role="alert"`) with the buttons
  re-enabled so the user can retry or cancel. Escape is locked while pending.
- Row-action failures no longer route through the Add-member card's shared
  error state — all row operations (activate/deactivate, pause/resume/cancel,
  delete) surface their errors in the modal where the user is looking.
- Paused members show an amber "Paused" badge; cancelled members show a
  neutral "Cancelled" badge (previously green "Active" even when
  check-in-blocked); members with no membership show neutral gray instead of
  vermillion "expired".
- Only one "More" row menu can be open at a time — menu-open state is lifted
  to the page (Members and Payments), so opening a second row's menu closes
  the first.
- ConfirmModal keyboard behavior: Tab focus is trapped inside the dialog,
  the backdrop dismisses on click, `aria-describedby` wires the body copy,
  and focus returns to the row's More trigger after close (stable trigger
  id — previously the captured menuitem unmounted, silently dropping focus
  to `<body>`).
- RowMenu is now a real menu: Arrow Up/Down/Home/End navigate items, focus
  moves into the first item on open, Escape/outside-click return focus to
  the trigger, and the panel caps at 70vh with scroll instead of running off
  the bottom of short screens.
- Login and Link-existing panels are real forms now — Enter submits them.
- The Add-member card sits above the All-members list (above the fold for
  the front-desk's dominant task); empty-state copy and panel scroll honor
  `prefers-reduced-motion`.
- QR codes are keyed per member — a slow generation can no longer overwrite
  a newer panel's image.
- Fixed the "Pauseing…"/"Resumeing…" pending-label typo.
- Verified: full suite 244/244 (34 files, live DB tests included);
  TypeScript, ESLint (`--max-warnings=0`), and production build clean.

## v1.012 — Critique fixes: in-app confirms, no mock fallback, menu groups (2026-08-17)

- Destructive confirmations (Delete, Cancel membership, Deactivate) moved
  from the browser's `window.confirm` into an in-app modal
  (`ConfirmModal.tsx`) — no default-focused OK, so Enter can no longer
  permanently delete; destructive dialogs focus Cancel first.
- The silent mock-data fallback when Supabase is unreachable is removed:
  the All-members card shows the real error with a Retry button instead
  of phantom members that vanish on refresh.
- The "More" menu groups actions with dividers (account / membership /
  status / Delete last), separating destructive items from common ones.
- Inline panels scroll into view when opened so actions never sit below
  the fold.
- Verified: full suite 235/235 (34 files, live DB tests included);
  TypeScript, ESLint (`--max-warnings=0`), and production build clean.

## v1.011 — UI overhaul: spec restoration, "More" menus (2026-08-17)

- Restores the Bold Typography design system from `docs/UI_DESIGN.md`:
  primary CTAs are text-only with a restrained animated-underline accent
  (new shared `buttonClasses.ts`), replacing the bordered button boxes that
  had drifted from spec and left Members rows with a wall of identical
  buttons.
- Rare row actions collapsed into a **"More" overflow menu**
  (`RowMenu.tsx`, lucide-react icons, keyboard/Escape + outside-click close,
  `role="menu"/"menuitem"`):
  - Members rows: Show/Hide QR, Set PIN, Create login, Link existing,
    Pause/Resume, Cancel membership, Deactivate/Activate, Delete —
    owner-gated where required.
  - Invoice rows (Payments, owner only): Void.
- Panels gained Cancel buttons (Create login, Link existing, Set PIN) and the
  PIN input auto-focuses, submits on Enter, and still strips non-digits.
- Breathing room: page headers and section descriptions get more space and
  wrap wider (PageShell, SectionCard).

## v1.010 — Member check-in PINs (C2), A8 scope decision (2026-08-17)

- Audit fix **C2** — check-ins can no longer be faked with a QR screenshot:
  - Staff set a per-member 4-6 digit PIN from the Members page (Set PIN panel;
    save again to change). A member without a PIN checks in as before.
  - Check-in (manual and QR paths) asks for the PIN when the member has one —
    wrong PINs are rejected with "Incorrect PIN." and nothing is recorded.
  - The PIN is **bcrypt-hashed in the database** — migrations `025`/`026` add
    `members.pin` + `rpc_set_member_pin` (owner/staff only; NULL clears) and
    `rpc_verify_member_pin` (returns ok/missing/fail). A BEFORE UPDATE trigger
    on `members.pin` rejects every direct table write unless the request came
    through the RPC, so a PIN can never be stored or read in plaintext
    (verified live: stored value starts with `$2a$06$` and never equals the
    plaintext; direct `UPDATE members SET pin = …` is blocked).
  - Fix: the "PIN saved" message was rendered inside the panel that closed on
    save — the panel now stays open with the message so staff see the result.
- **A8 — plan price history is a deliberate scope decision** (skipped): invoices
  already snapshot the price paid, so later plan price changes do not rewrite
  historical totals; historical prices are not re-derivable from plans.
- Verified: full suite 234/234 (34 files, live DB tests included) — including a
  live set → verify ok/wrong → clear → missing sequence and a hash-prefix check;
  TypeScript, ESLint, and production build clean.

## v1.009 — Pause/cancel memberships, per-staff collections (2026-08-17)

- Audit fixes **B2** and **A4 (close-out)**:
  - **B2 — memberships can be paused and cancelled from the Members page.**
    Active members get Pause / Cancel membership buttons, paused members get
    Resume / Cancel membership buttons, each with an explicit confirm naming
    the plan and end date (paused memberships are resumable; cancelling is
    final and a new payment starts a fresh membership). Paused or cancelled
    members are blocked from check-in (button disabled, row badge shows
    Paused/Cancelled) and the QR path refuses them with a clear message.
    The Supabase repository updates `memberships.status` directly (the
    `memberships_update_staff` RLS policy already covered this — no schema
    change), and the mock mirrors the same rule including the
    "No active membership to update." error.
  - **A4 — per-staff collection totals.** The Payments tab now shows
    "Collected by staff — today vs this month" grouped by the staff member
    who processed each payment.
  - Fix: the member's displayed membership is now the latest by start date
    (ties broken by end date/created time), so early-renewal chains no longer
    surface a stale membership row.
- Verified: full suite 228/228 (34 files, live DB tests included) — including a
  live pause → resume → cancel → reject-after-cancel sequence against RLS;
  TypeScript, ESLint, and production build clean.

## v1.008 — Money clarity, grace, uniqueness, invoice numbers (2026-08-17)

- Audit fixes **A4 (display)**, **A6**, **B3**, **B4**, **D1**, **A7**:
  - **A4 — payments now show who took the cash.** Payment rows display
    "taken by <staff name>" (join through `payments.processed_by`). Per-shift
    close-out is still future work.
  - **A6 — invoice form can no longer produce a past due date, and the plan
    prefills the price.** Selecting a plan fills total + due date (today +
    plan duration) and shows the price in the dropdown; a past due date is
    rejected (input `min` + submit guard).
  - **B3 — deactivating a member with an active membership warns exactly what
    is being blocked** ("active Monthly Pass until … — check-ins will be
    blocked immediately").
  - **B4 — 3-day expiry grace.** A member whose membership lapses can still
    check in for 3 days; the row shows "in 3-day grace until …". The hard
    block resumes after the grace window.
  - **D1 — member email/phone uniqueness, enforced by the database.**
    Migration `024` first collapses duplicate members (keep the oldest,
    re-parent billing history — collapsed 116 test-artifact duplicates in the
    live DB, 159 → 43 members), then adds partial unique indexes on
    email/phone (NULL/empty still allowed). Friendly messages surface the
    rejection in the UI; the mock mirrors the rule.
  - **A7 — sequential invoice numbers generated by the database.** Migration
    `024` adds a sequence + BEFORE INSERT trigger: `INV-YYYY-####`, seeded
    above the existing maximum. The client no longer generates numbers
    (removes the `INV-<Date.now()>` collision-prone scheme); the mock mirrors
    the format.
- Verified: full suite 223/223 (34 files, live DB tests included) — including
  live proofs that duplicate emails/phones are rejected by the new indexes and
  that invoice numbers are sequential and unique; TypeScript, ESLint, and
  production build clean.

## v1.007 — Overdue, owner-only actions, audit log (2026-08-17)

- Audit fixes **A3**, **D2**, **D3**, **E2**, and the **B1 follow-up (E3)**:
  - **A3 — overdue is now a stored server-side fact.** Migration `021` adds
    `invoices.is_overdue`, backfilled and kept in sync by a trigger on every
    write to status/due_at/paid_at. The repositories surface `overdue` as the
    invoice status, so payments, statements, and the ledger all read the same
    stored truth instead of each browser's clock. Caveat: the flag refreshes on
    writes — an invoice that crosses its due date with no write touching it
    stays `issued` until the next write (documented for the thesis).
  - **E2 — void and deactivate are owner-only, enforced in the database.**
    Migration `022` adds triggers that raise unless `auth_role()` is `owner`:
    invoices → `status = 'void'`, members → `is_active` false. Staff can still
    record payments, edit members, and reactivate. The Void and Deactivate
    buttons are hidden for staff. Live-tested by temporarily promoting the
    member test account to staff and back.
  - **D3 — audit trail.** Migration `022` adds `audit_log` (owner/staff
    select-only RLS) plus triggers that record who/when/what for invoice
    voids, member deletes, and check-in deletes. Migration `023` fixes two
    migration-022 bugs: PL/pgSQL does not short-circuit `AND` (each trigger
    read the other table's NEW record), and the audit INSERT was blocked by
    its own RLS — the function is now `SECURITY DEFINER`, so the trail cannot
    be bypassed or blocked by any client. New "Activity log" page shows the
    trail.
  - **D2 — member delete explains itself.** The delete path now checks for
    invoices/payments first and explains why the member cannot be deleted
    (FK RESTRICT), suggesting deactivation instead of a bare error.
  - **B1 follow-up (E3) — link an existing account to a member.** New Vercel
    function `api/link-account.ts` finds an existing auth user by email and
    links it to a walk-in member (owner/staff-only, no password ever set).
    "Link existing" next to "Create login" on member rows. Resolves self-
    signup orphan accounts.
- Verified: full suite 215/215 (34 files, run with `fileParallelism: false`
  so shared live accounts never race) including new live proofs for the
  owner-only triggers, the audit rows, and the overdue flag; TypeScript,
  ESLint, and production build clean.

## v1.006 — Void/check-in hardening (2026-08-17)

- Audit fixes **A5**, **C1**, **C3**, and part of **F1**:
  - **A5 + F1 — confirmations.** Voiding an invoice and deactivating a member now
    ask for confirmation first (previously one-tap, silently destructive).
  - **C1 — duplicate check-ins blocked.** A member can only check in once per Manila
    day, enforced in the repository (mock + Supabase) for both the manual and QR
    paths: a second same-day check-in is rejected with "Already checked in today."
  - **C3 — check-in correction path.** Migration `020_checkin_delete_policy.sql`
    (applied live) adds a DELETE policy on `check_ins` for owner/staff (members stay
    blocked — RLS policies OR together). The Today list and the attendance History
    now have a Delete button with confirmation; deleting a wrong check-in is the
    correction path (re-check in after if needed).
- Verified: full suite 183/183 including new live integration tests that prove the
  duplicate rejection and the delete policy against the migrated database;
  TypeScript, ESLint, and production build clean.

## v1.005 — Member logins for walk-ins (2026-08-17)

- Audit finding **B1** fixed: walk-in members (created with no account) can now get a
  login at the front desk. Previously nothing could create an account for them, so
  real members could never sign in, check in by QR, book classes, or see their own
  statement.
- New Vercel serverless function `apps/web/api/create-login.ts`. It verifies the caller
  is owner/staff (via their access token + RLS), creates the auth user with the
  service-role admin API (service key stays server-side as a Vercel env var —
  `SUPABASE_SERVICE_ROLE_KEY` — never bundled to the client), then links it to the
  member via the existing `members.user_id` column. Guards: member must exist, must not
  already have a login, email must not already be registered; a partially-linked user
  is rolled back.
- Members page: a **Create login** button appears on walk-in member rows (members with
  an account don't show it). It opens an inline form — email (prefilled from the
  member's email), password + confirm — and on success tells staff to hand the
  credentials to the member.
- No schema change: `members.user_id` and its unique index already existed.
- Verified: 37 new unit/component tests covering the function core (11), repositories
  (7), and the page flow (7), full suite green, TypeScript + production build clean.
  Live path UNVERIFIED until deployed — needs `SUPABASE_SERVICE_ROLE_KEY` set in Vercel.

## v1.004 — Payment money rules (2026-08-17)

- Database migration `019_payment_money_rules.sql` (applied live) fixes two audit
  findings:
  - **A1 — a payment must equal the invoice total exactly.** Partial payments and
    overpayments can no longer mark an invoice "paid" (previously ₱50 on a ₱1,500
    invoice was accepted as full payment). The `rpc_record_payment` RPC rejects any
    amount that differs from the invoice total.
  - **A2 — early renewals no longer lose days.** A renewal now extends from the
    current membership end date instead of today, so a monthly plan ending Sep 15
    renewed on Aug 10 ends Oct 15 instead of Sep 9. Paid periods overlap on paper
    (the standard gym convention for early renewals).
- Record-payment panel prefills the invoice total and shows an inline "Must equal
  ₱…" warning with the Confirm button disabled while the amount differs.
- New `phDateAfter` date helper; mock repository mirrors the new RPC rules.
- Verified: full suite 152/152 including live integration tests exercising both new
  rules against the migrated database; TypeScript and production build clean.

## v1.003 — Exact times everywhere (2026-08-16)

- Database migration `018_event_timestamps.sql` (applied live): `invoices.issued_at`,
  `invoices.paid_at`, and `members.joined_at` upgraded from DATE to TIMESTAMPTZ, so
  events keep their exact time. The `rpc_record_payment` paid-at parameter is now a
  timestamp too. Existing rows kept their dates (midnight Manila); nothing was lost.
- Invoice rows on Payments and on member statements now show "issued <date> <time>"
  and "paid <date> <time>" (due date stays date-only — it is a deadline).
- Member registrations stamp the actual time on the same day; a backdated "Joined
  date" keeps just the date. Members list and statement header show the join time.
- Check-ins and payment records already stored and displayed full timestamps.
- New shared `formatWhen` helper (date only for midnight/backdated, date + time otherwise).
- Verified: full suite 146/146 including live integration tests against the migrated
  database; TypeScript, ESLint, and production build clean.

## v1.002 — Button layout fix on list rows (2026-08-16)

- Fixed action buttons (Statement / Record payment / Void on invoices, and the
  member actions on the Members page) wrapping below the row when the description
  text is long. The action buttons now stay on one horizontal line; the text side
  shrinks and wraps instead.
- No behavior changes; cosmetic only.

## v1.001 — Front-desk usability overhaul (2026-08-16)

First versioned release. Baseline: member accounts, check-in QR, class bookings,
payments, member statements, and owner staff management were already live; this
release makes the lists usable by a gym owner or staff at the front desk.

### Members
- Search by name, phone, or email.
- Status chips (All / Active / Inactive) and membership filter (Any / Active / Expired / No membership).
- Pagination: 15 per page with "Showing 1–15 of N" and Prev/Next controls.

### Check-ins
- Reorganized into three tabs: Check in, Today, History.
- Empty search now shows the 5 most recent members instead of every member.
- Expired memberships are flagged on the row and the check-in button is disabled (QR path still shows the renewal message).
- Today list capped at the latest 10 with a jump to full history.
- History capped at 200 rows (narrow the range or export CSV for the rest).

### Payments
- At-a-glance summary strip: Outstanding, Collected this month, Overdue invoices.
- Two tabs: Invoices, Payments.
- Status chips with counts (All / Issued / Overdue / Paid / Void).
- Pagination on both lists (15 per page).
- Every invoice row links to the member's statement page.

### Design system
- New shared `StatusBadge` component with one meaning per color: green = active/paid,
  amber = issued/expiring, red = expired/overdue/inactive, gray = void/cancelled.
  (Fixes: "paid" was gray, "issued" was red.)
- New shared `Tabs` component.
- Muted text contrast raised `#737373` → `#A3A3A3` across all pages; badge text size
  standardized to 12px.
- Version indicator added to the Profile page.

### Verified
- Full suite: 146/146 tests passing, including live Supabase integration tests
  (member-limits, ledger, staff role changes). TypeScript, ESLint, and production
  build all clean.