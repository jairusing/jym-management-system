# Jym Management System — Master Plan

Authoritative plan for the business/thesis project. Created 2026-08-15. Approved by user.

## Goal
Build a **Gym business management system** ("Jym Management System") for the user's business/thesis, by first extracting the reusable skeleton of Jym Tracker into a standalone starter repo.

## Repo topology (3 repos)
1. `JymTracker` — this repo. Stays as-is, stays deployed. Becomes the **reference implementation** of the skeleton patterns.
2. **New repo: `web-starter`** — the extracted skeleton (generic, reusable). Publish as a GitHub **template repo** ("Use this template" button).
3. **New repo: `jym-management-system`** — the business/thesis app, cloned from `web-starter`, with a **fresh Supabase project** (never reuse this repo's anon key/URL/project).

## Naming
- Business/thesis app: **Jym Management System** (repo: `jym-management-system`).
- Starter repo: `web-starter`.

## Open decisions (resolved)
- **Billing**: record-only payments/invoices for the thesis. NO real payment processor (Stripe/GCash) for now.
- **Roles**: owner | staff | member via `profiles.role`.
- **Design**: keep the dark/orange design system for consistency.

## Phase 1 — Extract `web-starter` from this repo
**Keep (the skeleton):**
- `apps/web/src/main.tsx`, `App.tsx` (routing shell, minus fitness routes), `lib/supabase.ts`
- `features/auth/` — AuthContext, ProtectedRoute, AuthPage, PasswordResetCallback, ProfilePage + tests
- `components/ui/` — PageShell, SectionCard, ActionLink, BackLink + tests
- `index.css` + press-animation styles, `public/_headers`, `public/_redirects`
- Repository pattern (interface + Supabase impl + mock + integration test), ESLint/Vitest/Vite config, `.gitignore`, trimmed `CLAUDE.md`, docs skeleton

**Strip (fitness-specific):**
- `features/workouts/`, `features/workout/`, `features/progress/`, `features/bodyweight/`, `features/exercises/`, `lib/units.ts`
- Migrations 005–009 + fitness tables/seed in 001–004; slim to: profiles + `handle_new_user` trigger + grants/RLS base

**Verify:** `tsc -b`, eslint, unit suite, build. Then push as GitHub template repo.

## Phase 2 — Scaffold Jym Management System
Clone `web-starter` → `jym-management-system`. Create a **fresh Supabase project**, apply base migration, wire env vars, rename package.

## Phase 3 — Domain model + RLS (thesis core)
- `profiles.role` (owner | staff | member) → RLS per role: owner full access, staff read members + run check-ins, members see only their own bookings/check-ins
- Tables: `memberships` (plans), `members`, `check_ins`, `classes`, `class_bookings`, `payments`
- One repository per aggregate, each with mock + live integration tests (same pattern as Jym Tracker)

## Phase 4 — Features
1. Members CRUD
2. Check-in flow
3. Class schedule + bookings
4. Payments/invoices (record-only)
5. Owner dashboard (attendance, revenue)

## Phase 5 — Thesis deliverables
- ERD doc
- RLS role model chapter
- Integration-test evidence
- Demo seed data

## Current status
- Phase 0 (decisions): DONE — plan approved, decisions recorded above.
- Phase 1 (web-starter): DONE — extracted, 18/18 tests, pushed to https://github.com/jairusing/web-starter.
- Phase 2 (Jym Management System scaffold): DONE — cloned from starter, renamed, fresh Supabase project `osujvqcsomfawxxrhjty`, migrations 001–004 pushed (live RLS verified: anon → 0 rows), build OK, initial commit `798def2` (local; not yet pushed to GitHub).
- Phase 3 (domain model + RLS): DONE — migration `005_business_schema.sql` (10 tables: membership_plans, members, memberships, invoices, payments, check_ins, classes, class_sessions, class_bookings + `profiles.role` + `auth_role()` helper + full RLS per role) applied to live DB (anon → 0 rows on all tables), `002_table_grants.sql` extended, `supabase db lint` clean. Full-scale schema approved by user (invoice/payment split, membership history rows, walk-in members with NULL user_id, materialized class_sessions, processed_by audit trail).
- Phase 4.1 (Members CRUD): DONE — `features/members/` (memberRepository.ts + mock, supabaseMemberRepository.ts, MembersPage.tsx with add/toggle-active/delete, MembersPage.test.tsx 5 tests, supabaseMemberRepository.integration.test.ts 5 live tests skipped without JYM_TEST_EMAIL/PASSWORD), route `/app/members` + PageShell "Management" nav group. tsc/eslint/test (23 pass)/build all clean. Pending user actions: set own `profiles.role='owner'` in live DB; set JYM_TEST_EMAIL/JYM_TEST_PASSWORD (confirmed account on jms project) to run live integration suite; commit + push.
- Phase 4.2 (Check-in flow): DONE — `features/checkins/` (checkInRepository.ts + mock with member-name resolution, supabaseCheckInRepository.ts with `members(full_name)` join + `processed_by` from signed-in user + today-filtered `listTodayCheckIns`, CheckInsPage.tsx with member search/check-in/today's list, CheckInsPage.test.tsx 4 tests, supabaseCheckInRepository.integration.test.ts 4 live tests skipped without JYM_TEST_EMAIL/PASSWORD), route `/app/checkins` + nav item. No schema changes (check_ins table + RLS from 005 already live). tsc/eslint/test (27 pass)/build all clean. Same pending user actions as 4.1 apply.
- Phase 4.3 (Class schedule + bookings): DONE — `features/classes/` (classRepository.ts + mock with dayOfWeekLabels/week-window session listing, supabaseClassRepository.ts copying capacity/end_time/trainer from class on session creation, bookingRepository.ts + mock, supabaseBookingRepository.ts with member-name join + cancelBooking, ClassSchedulePage.tsx with add/delete class, per-class "Schedule this week" materialization, prev/next week nav, book/cancel member flow, ClassSchedulePage.test.tsx 5 tests, supabaseClassRepository.integration.test.ts 4 + supabaseBookingRepository.integration.test.ts 5 live tests skipped without JYM_TEST_EMAIL/PASSWORD), route `/app/classes` + nav item. No schema changes (005 RLS already covers all three tables). tsc/eslint/test (32 pass)/build all clean. Same pending user actions as 4.1 apply.
- Phase 4.4 (Payments/invoices, record-only): DONE — `features/payments/` (invoiceRepository.ts + mock with INV- numbering + markPaid/markVoid, supabaseInvoiceRepository.ts with member-name join + voidInvoice, paymentRepository.ts + mock that marks the invoice paid, supabasePaymentRepository.ts recording `processed_by` from signed-in user and flipping invoice to paid, PaymentsPage.tsx with issue-invoice form (member/amount/due date), invoice list with issued/paid/overdue/void badges + inline record-payment form (amount/method/reference) + void, payments list with PHP formatting, PaymentsPage.test.tsx 5 tests, supabaseInvoiceRepository.integration.test.ts 3 + supabasePaymentRepository.integration.test.ts 3 live tests skipped without JYM_TEST_EMAIL/PASSWORD), route `/app/payments` + nav item. No schema changes. tsc/eslint/test (37 pass)/build all clean. Note: integration rows persist in live DB (delete_none RLS + FK RESTRICT on invoices). Same pending user actions as 4.1 apply.
- Phase 4.5 (Owner dashboard): DONE — `features/dashboard/` (dashboardRepository.ts + mock with seed API computing today/week attendance, month/all-time revenue, outstanding, active members + weekly bar series, supabaseDashboardRepository.ts with parallel counts/sums + client-side day grouping, DashboardPage.tsx replacing the skeleton `/app` page: attendance stats + 7-day bar chart, revenue stats, membership count, DashboardPage.test.tsx 4 tests, supabaseDashboardRepository.integration.test.ts 3 live tests skipped without JYM_TEST_EMAIL/PASSWORD with >= assertions tolerant of pre-existing rows). No schema changes. tsc/eslint/test (41 pass)/build all clean. **Phase 4 (all five features) is COMPLETE.** Pending user actions: set own `profiles.role='owner'` in live DB; set JYM_TEST_EMAIL/JYM_TEST_PASSWORD to run all 7 live integration suites; commit + push 4.1–4.5 (still local, 1 commit behind origin).
- Phase 5 (thesis deliverables): DONE — `docs/ERD.md` (mermaid ERD + entity table + 6 verified design decisions), `docs/RLS.md` (auth_role() helper, full 11-table × action × role policy matrix, role boundaries, threat model, verification evidence), `docs/TESTING.md` extended with 7-suite evidence table + flake-resilience notes, `docs/DATABASE.md` pointer added. Migrations applied LIVE: `006_demo_seed.sql` (3 plans, 6 members, memberships, 12 check-ins over 7 days, 3 classes + current-week sessions, 5 bookings incl. 1 cancelled, 3 invoices 1 paid + 1 overdue, 1 gcash payment) and `008_promote_test_user_owner.sql` (temporary `007_bootstrap_test_user.sql` pushed then deleted). Test owner account created: `jms.test@demo.jms` / `Jms!Test2026` (profiles.role=owner) — use as JYM_TEST_EMAIL/JYM_TEST_PASSWORD. All 7 live integration suites pass against the live project (68/68 tests, 3 consecutive runs).
  - Real bugs found by the live suites and fixed: (1) PostgREST returns to-one FK embeds as objects, not arrays → normalized `Array.isArray(...)` in 5 repository mappers (checkin/class/booking/invoice/payment); (2) Supabase auth-fleet clock skew intermittently rejects fresh tokens → repos now use `auth.getSession()` for `processed_by` (was `getUser()`), live suites self-heal via beforeEach re-signIn + `test.retry: 1` in vite.config.ts; (3) AuthPage profile insert used non-existent `preferred_unit` column → fixed to real columns (name/email) so new signups actually create their profile row.
  - Owner account: DONE — `jairusingente3@gmail.com` signed up (profile auto-created after the AuthPage fix) and promoted via `009_promote_owner.sql` (role=owner, verified in live DB). Sign in at /auth with that email to use all owner features.
- Phase 6 (improvements): DONE — six improvements, committed as `6349bb3` and pushed to origin/main.
  - Exact time display (PH time): shared `lib/dates.ts` (`formatDateTime` with year + seconds, `formatDate` for DATE columns) — all timestamps (check-ins, payments, bookings) render in Asia/Manila regardless of device timezone; "today"/history date ranges use Manila-day boundaries; CSV exports Manila timestamps; membership/invoice date fields default to Manila calendar dates (commit `fabde95`).
  - Attendance history + CSV export: `checkInRepository.listCheckIns(from, to)` (mock + Supabase with gte/lte), CheckInsPage "Attendance history" card with date-range filter + Export CSV button (`attendanceCsv.ts` pure helper, UTF-8 BOM).
  - Booking capacity enforcement: `supabaseBookingRepository.bookSession` fetches session capacity + active booking count and rejects with "Session is at full capacity."; mock mirrors via `setSessionCapacity`; UI disables the book button and shows "Full" at capacity.
  - Membership renewal: migration `010_add_invoice_plan.sql` (schema change — `invoices.plan_id` nullable FK to membership_plans) applied live; invoice form gains plan select (`invoiceRepository.listPlans`); `recordPayment` marks the invoice paid then expires prior active memberships and inserts a new active one (started today, ended +plan.duration_days); MembersPage shows plan + expiry per member.
  - QR check-in: `qrcode` package installed; MembersPage "Show QR" per member (QR of the member UUID, lazy `toDataURL`); CheckInsPage "QR code or member ID" input records a check-in with method `'qr'`. In-app camera scanning DONE (commit `aa84098`): `QrScanner` overlay + `qrDecoder` (jsQR) — staff tap "Scan QR", point the camera at the member's QR, and the check-in is recorded automatically; camera errors fall back to manual ID entry.
  - Member self-service: `features/membership/` (membershipRepository + mock, supabaseMembershipRepository reading the signed-in user's member row + latest active membership), `MyMembershipPage` at `/app/my-membership` + "My membership" nav item (Account group).
  - Verification: tsc/eslint/build clean; full suite 86/86 against live project (19 files incl. new membership live suite covering null-profile, positive path with temp user_id link, cleanup); 52 pass / 34 skipped without env vars.
- Phase 7 (systems audit + hardening): DONE.
  - Deep adversarial audit executed per `docs/SYSTEMS_AUDIT_PROMPT.md` (committed cc321fc) covering auth, members, check-ins, classes, payments, membership, dashboard, lib/shell.
  - Code fixes (commit `3ab98e9`): recordPayment now rejects non-'issued' invoices (no double payments / duplicate memberships); rebooking a cancelled class booking updates the row instead of crashing on the unique constraint; paid invoices cannot be voided; dashboard stats use Manila-day boundaries instead of browser-local time; class sessions are constructed in +08:00 explicitly; member deletion requires confirmation.
  - Schema/RLS hardening (migration `011_audit_hardening.sql`, applied live, `supabase db lint` clean, commit `fe278bd`): (1) `rpc_record_payment()` SECURITY DEFINER RPC - atomic payment + invoice-paid + membership renewal in one transaction, staff/owner only, row-locked invoice; app `recordPayment` now calls it; (2) partial unique index on `memberships(member_id) WHERE status='active'`; (3) BEFORE INSERT trigger on `class_bookings` enforcing session capacity (blocks direct PostgREST bypass by members, verified by live test); (4) members can no longer update their own rows (staff/owner only policy `members_update_staff_only`).
  - Verification: tsc/eslint/build clean; full live suite 113/113 (24 files) including new live tests for rebook-after-cancel, duplicate-active rejection, already-paid/voided payment rejection, paid-void rejection, void-issued success, and DB-trigger capacity block.
  - Member-role live verification (commit `129ac78`, migration `012`): member test account `jms.member@demo.jms` / `Jms!Member2026` bootstrapped via SQL (GoTrue sign-in required all auth.users token columns non-NULL — supabase/auth#1940 — fixed by 013/016; API signup blocked for `@demo.jms`); `supabaseMemberLimits.integration.test.ts` (6 live tests) proves the RPC staff gate rejects member `recordPayment`, `members_update_staff_only` blocks member self-updates (PostgREST returns zero rows), and member booking still works. Suite now 119/119 (25 files).
- Phase 7.5 (business-side additions): DONE — commit `80a60a6` (membership expiry flags on MembersPage + check-in block for expired memberships, member statement pages `/app/members/:memberId` via new `features/ledger/` mock+Supabase repo, owner staff management `/app/staff` via new `features/staff/` — no schema changes; suite 132/132).
- Phase 8 (list UX overhaul): IN PROGRESS — approved by user 2026-08-16. Goal: make the app usable by a gym owner/staff at the front desk (thesis hand-over). No schema/RLS changes, no new routes (tabs, not pages), client-side search (≤200 members).
  - Principles: front-desk actions ≤2 taps; every list browsable (search/filter/pagination/count); status colors mean the same thing everywhere (green=active/paid, amber=issued/expiring/paused, red=expired/overdue/inactive, gray=cancelled/void/none).
  - 1) Shared `StatusBadge.tsx` component + readability pass: muted text `#737373` → `#A3A3A3`, badge text 0.7rem → 0.75rem, fix Payments semantics ('paid' was gray, 'issued' was red → green/amber).
  - 2) MembersPage: search (name/phone/email), chips All/Active/Inactive, membership select (Any/Active/Expired/None), pagination 15/page with "Showing 1–15 of 47" + Prev/Next, header count.
  - 3) CheckInsPage → 3 tabs: "Check in" (QR on top, search shows only matches, empty query → hint + 5 recent, expired tag on rows), "Today" (last 10 + count + "View full history" jumps to History tab), "History" (date range + CSV, capped display).
  - 4) PaymentsPage → 2 tabs + summary strip (Outstanding · Collected this month · Overdue count): Invoices tab (form on top, status chips with counts, 15/page pagination, record-payment expands only the selected row, rows link to member statement), Payments tab (count + pagination).
  - 5) Statement/Staff pages adopt StatusBadge.
  - 6) Tests for search/filter/tabs/pagination/single-row payment; full harness; commit + push (Vercel auto-deploy).
  - Deferred (flagged, not approved): printable receipts, expiring-this-week dashboard alert, kiosk/member-facing mode.
- Phase 8.5 (versioning convention): SHIPPED as v1.001 (commit `7a53bc4`). Every shipped change bumps `apps/web/package.json` version (1.001 → 1.002 → …), adds an entry at the top of `CHANGELOG.md` (repo root of jym-management-system), and the Profile page shows "Version {version}" at the bottom (imported from package.json — single source of truth). Before any commit: check the changelog + version bump are included.
