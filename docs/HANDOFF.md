# Jym Management System — Session Handoff

Read this file FIRST (along with `CLAUDE.md` in this repo) before touching any
code. It tells you where everything lives, what was done, what the rules are,
and what comes next.

## Repo layout (important — two repos exist)

| Repo | Role |
| --- | --- |
| `C:\Users\Jairus\Desktop\VS stuff\Random Projects\jym-management-system` | **THIS repo — the actual product.** All code, schema, migrations, and all JMS docs. Open new sessions here. |
| `C:\Users\Jairus\Desktop\VS stuff\Random Projects\Jym Tracker` | The original **workout-tracker** app. Its `docs/` are workout-app specs, NOT JMS. Only JMS artifact left there is `docs/UI_DESIGN.md` (kept in sync; the authoritative copy is in this repo). |

This repo's `docs/` is the single source of truth for JMS docs:
`PLAN.md` (phase plan incl. Phase 8 + versioning convention),
`ARCHITECTURE.md`, `DATABASE.md`, `ERD.md`, `RLS.md`, `UI_DESIGN.md`,
`TESTING.md`, `USER_FLOWS.md`, `AUDIT.md`, `SYSTEMS_AUDIT_PROMPT.md`.
Note: `.github/copilot-instructions.md` and `docs/PRODUCT.md` are referenced in
the Jym Tracker `CLAUDE.md` but do NOT exist in this repo — don't look for them.

## Product

Gym management system (Philippines, PHP currency, Asia/Manila times): members,
membership plans, check-ins (QR + search), invoices/payments (record-only, no
payment processor), member statements, class bookings, staff roles, dashboard.
Roles: owner / staff / member — enforced by Supabase RLS, proven by live tests.

## Progress so far

- **Phase 8 (list-UX overhaul)** — StatusBadge + contrast pass (#A3A3A3),
  Members search/filter/pagination, Check-ins 3 tabs, Payments tabs + summary
  strip + chips + pagination. Full suite green.
- **v1.001** — CHANGELOG.md + version indicator on Profile page (imports
  `package.json` version; single source of truth).
- **v1.002** — fixed list-row action buttons wrapping on long descriptions.
- **v1.003** — exact times: migration `018` upgraded `invoices.issued_at` /
  `invoices.paid_at` / `members.joined_at` DATE → TIMESTAMPTZ; `formatWhen`
  helper; member joins stamp exact time when same-day.
- **v1.004** — audit fixes A1 + A2 via migration `019`: (A1) payment amount
  must equal invoice total exactly; (A2) renewals extend from the current
  membership end date (early renewals no longer lose days). UI shows an inline
  "Must equal ₱…" hint and disables Confirm on mismatch.
- **v1.005** — audit fix B1: walk-in members can now get a login. New Vercel
  serverless function `apps/web/api/create-login.ts` (service-role admin API;
  `SUPABASE_SERVICE_ROLE_KEY` is a Vercel env var, never client-side) + "Create
  login" inline form on walk-in member rows in MembersPage. No schema change
  (`members.user_id` already existed). New feature folder
  `apps/web/src/features/memberAccounts/`.
- **v1.006** — audit fixes A5/C1/C3/F1: Void + Deactivate confirmations;
  duplicate same-day check-ins rejected (repository-level, manual + QR paths);
  check-in correction via migration `020` (owner/staff DELETE policy on
  `check_ins`) + Delete button on Today/History rows.
- **v1.007** — audit fixes A3/D2/D3/E2 + B1 follow-up: stored `is_overdue`
  (migration `021` + trigger); owner-only void/deactivate enforced by DB
  triggers (migration `022`) + hidden buttons; `audit_log` table + triggers +
  Activity log page (migration `022`, fixed by `023`); member-delete explains
  blocked deletes; `api/link-account.ts` + "Link existing" for orphan
  accounts. Test suite now runs files serially (`fileParallelism: false`) to
  keep the shared live test accounts deterministic.
- **v1.008** — audit fixes A4(display)/A6/B3/B4/D1/A7: payment rows show
  "taken by <staff>"; plan select prefills total + due date with past-due
  rejection; deactivation warns about the active membership; 3-day expiry
  grace with an on-row notice; migration `024` dedupes members (kept oldest;
  live DB 159 → 43) and adds partial unique indexes on email/phone (friendly
  "already exists" errors); invoice numbers are now DB-generated sequential
  `INV-YYYY-####` (sequence + BEFORE INSERT trigger, seeded above max).
  Live integration tests create members with unique phones (the fixed test
  phones are now blocked by the indexes).
- **v1.009** — audit fixes B2 + A4(close-out): Members page Pause / Resume /
  Cancel membership actions (confirms name the plan + end date; paused is
  resumable, cancelled is final). Paused/cancelled members are blocked from
  check-in (disabled button, row badge, QR refusal). No schema change —
  `memberships_update_staff` RLS already allowed the status update.
  Payments tab adds "Collected by staff — today vs this month" totals.
  Fixed a display bug where early-renewal chains (memberships sharing the
  same start date) could surface a stale membership row: the latest is now
  picked by start date with end date/created-time tie-breaks.
- **v1.010** — audit fix C2: per-member check-in PINs. Members page sets a
  PIN (Set PIN panel; optional, 4-6 digits); check-in (manual + QR) asks for
  it and rejects wrong PINs. PINs are bcrypt-hashed in the DB — migrations
  `025`/`026` add `members.pin`, `rpc_set_member_pin` (owner/staff only,
  NULL clears), `rpc_verify_member_pin` (ok/missing/fail), and a BEFORE
  UPDATE trigger that blocks direct writes to `members.pin` outside the RPC
  (no plaintext store/read). Fix: PIN success message no longer hidden by
  panel close. A8 (plan price history) declared a scope decision — invoices
  snapshot the price paid. NOTE: PowerShell `Set-Content -Encoding UTF8`
  adds a BOM that crashes Vite's PostCSS config load — write package.json
  with .NET `[System.IO.File]::WriteAllText` instead.
- **v1.011** — UI overhaul (full spec restoration per `UI_DESIGN.md`):
  Members + Payments rows collapsed their action walls into a "More" menu
  (`apps/web/src/components/ui/RowMenu.tsx`, lucide-react icons), CTAs are
  text-only with animated underline accents (`components/ui/buttonClasses.ts`),
  and page/section descriptions got more breathing room (PageShell, SectionCard).
  Actions moved into the menu: Member rows — Show/Hide QR, Set PIN, Create
  login, Link existing, Pause/Resume, Cancel membership, Deactivate/Activate,
  Delete (owner-gated where relevant); Invoice rows — Void (owner only).
   Test note: RowMenu items are `role="menuitem"`, so tests query them with
   `getByRole('menuitem', …)` after opening the row menu (`openRowMenu` /
   `openInvoiceMenu` helpers). Menu items only render while open, so closed-menu
   assertions use `queryByRole(...)toBeNull()`.
- **v1.012** — critique fixes (P0/P1) on the Members page: destructive
   confirms are now an in-app modal (`components/ui/ConfirmModal.tsx`;
   `window.confirm` removed — no default OK/Enter-delete; destructive dialogs
   focus Cancel first). Members page no longer falls back to mock data when
   Supabase fails — it shows the real error + Retry. The More menu groups
   actions with dividers (account / membership / status / Delete last).
   Inline panels scroll into view on open (`scroll-mt-4` + scrollIntoView),
   and sibling panels close when another opens. Test note: modal flows assert
   dialog text split across title/body elements (`getByText` per element),
   then click the confirm button by label. The error/Retry test toggles
   `hasSupabaseConfig` via a `vi.hoisted` getter + mocked Supabase repos.
- Migrations: `001`–`013`, `016`, `018`, `019`, `024`–`026` all applied to the
  live project. (`014`, `015`, `017` were deleted + marked reverted.)
- Full suite: **235/235 (34 files)** including live integration tests. Build:
  `tsc -b && vite build` clean. Deployed via Vercel auto-deploy on push to
  main → https://jym-management-system.vercel.app/

## Rules and conventions (the ones that cost us time)

- **Version every shipped change**: bump `apps/web/package.json` (1.004 → 1.005)
  + add an entry at the top of `CHANGELOG.md`. Profile page shows the version.
- **No code comments** in app code. Test files may have header comments.
- **Schema/migration/RLS/RPC changes require explicit user approval first.**
- **Never guess**: the repo, migrations, and terminal output are authoritative.
  Label claims VERIFIED / INFERENCE / RECOMMENDATION / UNKNOWN.
- **Report format** at the end of each task: VERIFIED / CHANGED / TESTED /
  UNVERIFIED / NEXT STEP.
- **PowerShell gotchas** (this machine runs PowerShell 5.1):
  - `$?` after a pipeline reflects the LAST command (e.g. `Select-String`),
    not npm — check failures explicitly.
  - `git commit -m` must be a SINGLE LINE (multi-line strings get split into
    pathspecs). No `&&`; use `;` or `if ($?)`.
  - Avoid `\"` inside double-quoted strings (PowerShell doesn't backslash-escape).
- **Supabase CLI** (not on PATH; writes to stderr — "error" noise is normal):
  `C:\Users\Jairus\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe`
  - Apply migrations: pipe `"Y"` in: `"Y" | & <exe> db push`
  - Verify: `& <exe> migration list` (Local + Remote should match)
- **Live test suite** (in `apps/web`), requires these env vars before
  `npx vitest run`:
  `JYM_TEST_EMAIL=jms.test@demo.jms`, `JYM_TEST_PASSWORD=Jms!Test2026`,
  `JYM_MEMBER_EMAIL=jms.member@demo.jms`, `JYM_MEMBER_PASSWORD=Jms!Member2026`
  (dev/demo accounts bootstrapped in `006_demo_seed.sql` / earlier migrations).
- Unit tests (mock repos, no env): run without the env vars — live tests skip.
- Model cannot view images — screenshots must be described in text.

## What's next (from `docs/AUDIT.md`)

1. **C2 ✅ FIXED (v1.010)** — member check-in PINs (bcrypt-hashed in the DB).
   Optional follow-up: a "PIN required" flag per member so staff can mandate
   PINs instead of relying on members having set one.
2. **A8 — plan price history**: declared a scope decision (invoices snapshot
   the price paid; historical totals stay correct).
3. **B5** — renewal reminders (dashboard alert, deferred).
4. Deferred features (document as deliberate): receipts, renewal reminders,
   analytics, kiosk mode.

Deploy note for v1.005: before the live create-login path works, set
`SUPABASE_SERVICE_ROLE_KEY` in the Vercel project env (and confirm
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are already there — they are
used by the function too). In local dev the function isn't reachable (vite has
no `/api` route) — the mock path covers the UI; live verification needs
`vercel dev` or the deployed site.

Full audit (severity-tagged) in `docs/AUDIT.md`; strengths to defend:
database-enforced invariants, RLS + live tests, Manila timezone correctness.

## Verification commands (from `apps/web`)

- `npx vitest run` (with env vars above for full 235/235)
- `npm run build` (tsc -b + vite build)

## Key files

- `supabase/migrations/` — schema is authoritative; read before db work
- `apps/web/api/` — Vercel serverless functions (`create-login.ts` = B1)
- `apps/web/src/features/{members,checkins,payments,ledger,classes,staff,auth,membership,dashboard,memberAccounts}/`
- `apps/web/src/lib/dates.ts` — timezone helpers (`formatWhen`, `phDateAfter`, …)
- `docs/USER_FLOWS.md` — how the system is used (owner/staff/member scenarios)
