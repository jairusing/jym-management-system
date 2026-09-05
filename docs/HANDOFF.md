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

**Project context (recorded 2026-08-21):** deployed at
`jym-management-system.vercel.app` (Vercel auto-deploys `main`). The project is
primarily a **thesis** deliverable but has a real possibility of being used in
an **actual gym** — treat data-integrity and security items accordingly, and
prefer honest states over demo conveniences in anything user-facing.
Auth today: Supabase email+password with an email-confirmation flow on signup
("Check your email"); there is NO per-login 2FA/MFA in code — any email step
beyond that would be a Supabase dashboard setting, not app behavior.

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
- **v1.013** — critique rounds 2-5 (P0s + P1s + P2s): ConfirmModal lifecycle —
   it stays open while the op runs ("Deleting…" disabled state), closes only
   on success, renders failures inside the dialog with Retry enabled, and
   locks Escape while pending. All row actions (incl. Activate) route through
   the modal — no errors anchor in the Add-member card (`addError` is scoped
   to the Add form). Status honesty: paused = amber, cancelled = neutral gray
   (was green "Active" while check-in-blocked), no-membership = neutral gray.
   RowMenu: controlled `open`/`onOpenChange` (one menu open at a time,
   Members + Payments), optional `id` on the trigger, Arrow Up/Down/Home/End
   navigation, focus-in on open, Escape/outside-click restores focus to the
   trigger, 70vh cap with scroll. ConfirmModal traps Tab, dismisses on
   backdrop click, and restores focus to the row's More trigger via a stable
   DOM id (the old activeElement capture was a dead code path — the menuitem
   unmounted before restore). Login/link panels are `<form>`s (Enter
   submits). Add-member card sits above the list; empty-state copy and scroll
   honor `prefers-reduced-motion`. QR data is keyed per member (no stale
   overwrite race). Test notes: failure tests spy a repo method to reject
   once then retry; the pending-label test controls a promise via
   `mockImplementationOnce` and asserts "Pausing…" before releasing;
   multi-open test asserts exactly one `aria-expanded="true"` More button;
   Enter tests use `fireEvent.submit` on the panel form.
- **v1.014** — critique round 6 (Check-ins P0s + P1s + PIN input): success/
   error banners are live regions (`role="status"` / `role="alert"`), and a
   member's row disables to "Checked in today" after a check-in — the outcome
   is visible at the action. A pre-check in `beginCheckIn` blocks duplicate
   check-ins before any repo call (covers the QR path too). The PIN panel
   moved below the search form (next to the member list the user is in),
   autofocuses the PIN input (now `type="password"`), and scrolls into view.
   Delete uses the shared ConfirmModal with in-dialog error/pending states
   and a "Check-in deleted." success message. Test notes: modal delete tests
   scope queries with `within(dialog)` (the row's Delete button stays
   mounted); the double-check-in test asserts the disabled "Checked in
   today" button instead of the old repo-error path.
- **v1.015** — critique round 7 (Check-ins re-critique P0+P1s + approved
   P2s): the status line moved inside each SectionCard (above the fold of
   the action) with mutual exclusion — `showError`/`showSuccess` clear the
   other banner, fixing the success-then-refresh-failure contradiction.
   ConfirmModal now restores focus to the trigger on close via a
   render-phase `useRef(document.activeElement)` capture (autoFocus would
   otherwise steal it) — benefits Members too. Enter keys are live: search
   submit checks in the first match, the QR input is its own `<form>`.
   "Check in via QR" demoted to ghost (Scan QR stays the single primary);
   "Checked in today" became a green StatusBadge (`tone="good"`) next to the
   name. Test notes: the cancel-delete test calls `deleteButton.focus()`
   before opening the modal (jsdom `fireEvent.click` does not move focus)
   then asserts `document.activeElement` is the trigger after close; the
   coexistence test spies `listTodayCheckIns` to reject once after the
   initial load and asserts `queryByRole('status')` is null while
   `getByRole('alert')` shows the failure; both forms carry `aria-label` for
   `getByRole('form', { name })` queries.
- **v1.016** — critique round 8 (Payments re-critique P0+P1s + approved
   P2s): void is now the shared ConfirmModal (danger, "Voiding…" pending,
   in-dialog error, focus restore) — `window.confirm` is gone; the two
   tests that spied on it now drive the real dialog (confirm + cancel).
   Success feedback is actually wired — `setSuccess` was never assigned, so
   success was structurally impossible; now issue/record/void announce in
   `role="status"` lines inside the working cards (issue card + list card).
   Supabase load failure no longer falls back to fabricated mock money:
   real error + Retry (Members pattern), and the Payments tab shows the
   same honest state instead of "No payments yet". Row "Record payment"
   demoted to ghost (One Voice Rule); void RowMenu passes its `id` so focus
   restores to the trigger; member select recalls the member after issuing
   and sorts options by name. Test notes: `vi.hoisted` mutable
   `supabaseConfig` + mocked Supabase repo classes (Members pattern) for
   the load-error/Retry test; feedback assertions use `getAllByText` since
   the banner renders in two cards at once.
- **v1.017** — critique round 9 (Payments re-critique P1s + P2s): the
   Summary strip shows an em-dash on all three figures while loading or
   when the Supabase load failed — no fabricated "₱0.00 Outstanding".
   Feedback is home-scoped: `showError`/`showSuccess` take a
   `FeedbackHome` ('issue' | 'invoices') so each card only announces its
   own work; the stray StatusLine in the Payments card is gone. Void
   focus restore moved from a render-phase capture of a just-unmounted
   menuitem to ConfirmModal's new optional `restoreFocusId` prop (points
   at the live `invoice-menu-<id>` trigger). The payment panel is now a
   `<form aria-label="Record payment">`: Enter submits, amount
   autofocuses, Confirm disabled while the amount is empty, the row
   toggle gets `aria-expanded`/`aria-controls` and locks while paying,
   the mismatch hint is `aria-invalid` + `aria-describedby`, the void
   menu item is disabled while a void is pending. Test notes: em-dash
   assertions scope queries to the Summary card with
   `within(summaryCard)` (the PageShell description also contains an
   em-dash) and use `queryAllByText` to assert the placeholders are gone
   (`getAllByText` throws on zero matches).
- **v1.026** — critique round 11 (Check-ins, re-critique scored 31/40,
   up from 29; user approved "both P1s" + local danger color, token
   refactor stays deferred): (1) PIN dead-end escape hatch — the PIN
   panel now explains why the PIN is asked and adds a "Member forgot PIN"
   link that opens a staff-confirmed "Check in anyway? This bypasses the
   PIN verification." override (`handlePinOverride` completes the check-in
   with the normal method). NOTE: the override records a normal check-in;
   persisting a "PIN bypassed" flag would require a schema change on
   `check_ins` (no note column) — deferred pending explicit approval.
   (2) Search Enter is no longer a dead no-op: `handleSearch` focuses the
   first match's `checkin-button-<id>` (both the filtered and recent
   member rows now carry that id) without checking in — Enter is still an
   explicit two-step. (3) `dangerButtonClass` now uses a dedicated
   `#DC2626` danger token (documented as a new `danger` color in
   `docs/UI_DESIGN.md`) so destructive actions stop competing with the
   #FF3D00 brand/error red; repo-wide hex-to-token extraction remains
   deferred. New tests: "lets staff override the PIN gate when the member
   forgot their PIN" and "moves focus to the first match Check in button
   when the search form is submitted" (asserts `document.activeElement`
is the button and no check-in was recorded). Verified: full suite
    267/267 (199 runnable + 68 skipped), lint/tsc/build clean, detector 0
    findings.
- **v1.027** — critique round 6 (Payments, 30/40; round-6 finding was that
   the v1.026 danger split + Outstanding-in-error-red were live on screen;
   user approved "both P1s" + "all three P2s" + partial-payment "investigate
   later"): (1) P1 — Outstanding no longer red (money owed ≠ error): renders
   in paper #FAFAFA, only the Overdue count keeps #FF3D00. (2) P1 — the
   #DC2626 danger split is REVERSED: `dangerButtonClass` returns to the
   vermillion ghost anatomy and `#DC2626` is removed from the palette;
   `docs/UI_DESIGN.md` now states danger = same accent, one voice, ghost
   anatomy with vermillion text/underline, NOT a distinct color. (3) P2 —
   Issue-invoice form collapses behind a "New invoice" button (list-first),
   with a Cancel escape; empty state points to "New invoice". (4) P2 —
   invoice + payment rows restructured: member name is the title, run-on
   meta is now `number · plan · issued · due · paid` with date-only (fixing
   the datetime-vs-date precision mismatch), amount is a right-aligned
   font-mono figure. (5) P2 — search filter by member name or invoice
   number above the chips; composes with status filter; page resets on
   either; empty state distinguishes no-invoices / no-filter / no-search.
   (6) "Collected by staff" box is now hairline-separated, no filled panel.
   PARTIAL-PAYMENT POLICY PARKED: recording a payment whose amount differs
   from the invoice total (e.g. member pays ₱1000 of a ₱1500 invoice) is
   intentionally NOT implemented in the UI — the repo's A1 trigger requires
   exact match, and a real partial-payment flow needs product + schema
   decisions (new `invoices.paid_amount` or split lines). Investigate later,
   needs explicit approval. Verified: full suite 269/269 (201 runnable + 68
   skipped, 27 Payments tests incl. 2 new), lint/tsc/build clean, detector 0
   findings.
- **v1.028** — critique round 7 (Payments, 36/40, Excellent; user chose
   "fix the 2 P2s now" + "option 1 — surface the rule"): (1) P2 — the
   Payments tab's run-on meta line now mirrors the Invoices anatomy
   (member name title; method · reference · invoice number; paid datetime ·
   taken-by; mono amount right) so both tabs speak one rhythm. (2) P2 — the
   exact-amount payment rule was a silent wall; the Record payment panel
   now opens with a calm one-line hint "Payment must equal the invoice
   total of ₱…" while the hard guard and red "Must equal ₱X" mismatch hint
   stay. Full partial-payment support remains parked (needs schema/RPC
   decision + explicit approval — see deferred list). Verified: full suite
   269/269 (201 runnable + 68 skipped), 27 Payments tests, lint/tsc/build
   clean, detector 0 findings. NEXT: Check-ins round-12 re-critique
   (deferred since v1.026 shipped at 31/40).
- **v1.029** — critique round 12 (Check-ins, both P1s fixed): (1) P1 — the
   two-step Enter→focus was invisible because `primaryButtonClass`
   focus-visible was identical to idle (text vermillion + 10% underline
   stretch), so a double-Enter could still accidentally check someone in.
   All four button classes in `buttonClasses.ts` now carry a 2px #FF3D00
   ring with 2px #0A0A0A offset on `focus-visible` (per UI_DESIGN.md "2px
   ring in accent, 2px offset"); the recent-members helper copy now teaches
   "type to search, press Enter to select, then Check in". (2) P1 — a
   member in the 3-day grace window (expired but check-in-able) was painted
   red "Expired" + red message; now amber #FFB300 "Expiring" badge + amber
   message, red reserved for paused/cancelled/past-grace, at most one red
   badge per row. `StatusBadge` warning tone now used. PIN override audit
   flag kept as-is per user decision (any staff may bypass; permanent
   "PIN bypassed" marker needs a schema change on `check_ins` — deferred
   pending explicit approval). Verified: full suite 269/269 (201 runnable +
   68 skipped), 33 Check-ins tests, lint/tsc/build clean, detector 0,
   ring utilities in built CSS. NEXT: re-critique Check-ins (round 13) to
   confirm the two P1s closed and the score moves past 31.
- **v1.030** — critique round 13 (Check-ins, 32/40; both v1.029 P1 fixes
   verified landed; user approved closing the four two-round survivors as
   one batch): (1) success StatusLine now #22C55E green (was white body
   text). (2) per-row vermillion Delete buttons on Today/History replaced
   with RowMenu (danger item, Trash2 icon) + ConfirmModal restoreFocusId
   back to the row's `checkin-menu-<id>` trigger. (3) the QR form and
   search form merged into ONE "Search or member ID" field: exact member-ID
   match routes to handleQrCheckIn (PIN gate intact), otherwise Enter
   focuses the first match's Check in button; qrCode/qrCheckingIn state
   removed; empty-state copy now "No members match that search." (4)
   LoadError now amber #FFB300 border on raised #1A1A1A (matches the PIN
   override attention pattern). Test notes: delete tests open the RowMenu
   ("More" button → "Delete" menuitem); QR-paste tests submit the unified
   form (`getByRole('form', { name: 'Check in a member' })`); unknown-ID
   test now expects the search empty state instead of the ID error.
   Verified: full suite 269/269 (201 runnable + 68 skipped), 33 Check-ins
   tests, lint/tsc/build clean, detector 0. NEXT: re-critique Check-ins
   (round 14) to score the batch.
- **v1.031** — critique round 14 (Check-ins; all four v1.030 fixes
   detector-verified landed, but fresh-eyes re-weighting surfaced that the
   merged field's Enter could still fail silently — focus() on a
   nonexistent/disabled button — dropping the score 32 → 29; user approved
   fixing the P1 + two hard P2s): (1) handleEntrySubmit now skips
   checked-in/inactive/expiry-blocked matches and focuses the first
   ACTIONABLE match's button; when nobody can check in it shows "Everyone
   matching is already checked in or blocked from checking in." instead of
   a silent no-op. (2) after a successful delete, focus moves to the
   neighboring row's `checkin-menu-<id>` trigger via setTimeout(0) after
   refresh (the ConfirmModal restore target unmounts with the row). (3)
   history load failures now set `historyLoadError` and render the amber
   LoadError + Retry (parity with Check-in/Today); raw error demoted to
   console.warn. Test notes: record check-ins BEFORE renderPage or
   component state won't see them; focus assertions use row-scoped
   querySelector, not id construction. Verified: full suite 273/273 (205
   runnable + 68 skipped), 37 Check-ins tests incl. 4 new, lint/tsc/build
   clean, detector 0. NEXT: re-critique Check-ins (round 15).
- **v1.032** — critique round 15 (Check-ins FINAL fix round; loop declared
   converged after three fresh-eyes scorers returned 32 → 29 → 28 while
   every P1 was fixed and detector-verified each round): (1) the four
   write-path catches now use `toUserError(e, fallback)` — a whitelist of
   domain messages ("Already checked in today.", "Select a member to check
   in.", "Check-in not found.") passes through; everything else shows calm
   copy ("Couldn't record/start… Please try again.") with raw error to
   console.warn. (2) completeCheckIn restructured: record failure and
   refresh failure are now DISTINCT — record success + refresh failure
   shows "<Member> is checked in, but the list may be out of date."
   (honest-warning pattern from Payments) instead of raw 'Network
   failure', which read as "the check-in failed" and invited duplicate
   retries. (3) inverted From>To history ranges render "From must be on or
   before To." inline (derived from field values, no extra state). (4)
   grace badge renamed "Expiring" → "Grace" (it sat above a sentence
   saying "Membership expired…" — contradiction). Test notes: the
   refresh-failure test now asserts /checked in, but the list may be out
   of date/i AND that the raw error text is gone; grace test asserts
   getByText('Grace'). Verified: full suite 275/275 (207 runnable + 68
   skipped), 39 Check-ins tests, lint/tsc/build clean, detector 0.
   NEXT: Check-ins critiques paused — remaining known items are P3 polish
   (touch targets, MemberRow extraction, autofocus, PIN digit clearing,
   last-row delete focus, Tabs arrow-roving). Candidate next surfaces:
   MembersPage or DashboardPage critiques.
- **v1.033** — critique round 6 (Members, 26/40; user approved fixing the
   2 P0s + 2 P1s — all were ports of patterns already built on other
   pages): (1) P0 — membershipState() now has a 'grace' tone using the
   same 3-day window as Check-ins: amber "Grace until {date} — expired
   {date}" instead of bold-red "Expired", and grace members count under
   the "Active membership" filter; red stays past-grace only. (2) P0 —
   `toUserError()` helper + DOMAIN_ERROR_MESSAGES whitelist at all six
   catch sites (load/add/login/link/PIN/confirm); deliberate server
   messages pass through (incl. create-login/link-account API strings),
   supabase-wrapped composites are prefix-stripped, everything else gets
   calm fallback copy + console.warn. (3) P1 — load failures render the
   amber LoadError panel (border-[#FFB300] bg-[#1A1A1A], role="alert",
   ghost Retry). (4) P1 — status chips got aria-pressed and shared
   chipClass now enforces min-h-[44px] touch targets (Payments chips
   inherit this too). Test notes: load-failure test asserts amber panel
   classes + absence of raw text; new grace test covers display +
   active/expired filter membership. Verified: full suite 276/276 (208
   runnable + 68 skipped), 41 Members tests, lint/tsc/build clean,
   detector 0. NEXT: Members re-critique to score the fixes, or Dashboard
   first critique.
- **v1.034** — critique round 4 (Dashboard, 20/40; user approved P0s+P1s+
   accent batch): (1) P0 — local `heroButtonClass` deleted; "Record a
   check-in" now uses shared primaryButtonClass + text-base, inheriting
   the 2px focus ring (the local class had omitted all ring utilities).
   (2) P0 — catch block no longer persists e.message; static human copy on
   both failure paths ("We couldn't reach the database…" / refresh
   variant), raw error in console.warn; off-palette #737373 detail text
   removed entirely. (3) P1 — both error panels now amber LoadError
   anatomy (border-[#FFB300] bg-[#1A1A1A], role="alert", ghost Retry).
   (4) P1 — Revenue card links "View payments" → /app/payments, Membership
   card links "View members" → /app/members. (5) P2 — hero numeral
   text-6xl sm:text-7xl; chart bars: today = bg-[#FF3D00], nonzero history
   = bg-[#262626], zero = bg-[#1A1A1A]; the rounded-full dot is deleted.
   Test notes: error tests assert amber panel classes + absence of raw
   strings ('db unavailable'/'refresh hiccup'); new tests cover deep-link
   hrefs and the today-bar accent rule via chart role="img" query.
   Verified: full suite 278/278 (210 runnable + 68 skipped), 9 Dashboard
   tests, lint/tsc/build clean, detector 0, off-palette hex 0. NEXT:
   re-critique Dashboard or Members to score fixes; remaining known
   dashboard items are P3 (loading-skeleton morph, demo-notice prominence,
   timezone seam INFERENCE in repo date bucketing).
- **v1.035** — critique round 5 (Dashboard, 30/40; all five v1.034 fixes
   verified landed; reviewer caught a regression the accent fix introduced
   — history bars #262626 on #0F0F0F ≈ 1.26:1 contrast, invisible; user
   approved the batch): (1) nonzero history bars now bg-[#A3A3A3] (~4.6:1,
   on-palette), zero stays #1A1A1A, today keeps #FF3D00. (2) Attendance
   card compressed: chart h-40 → h-32, redundant "Last 7 days" Stat
   removed (it summed the visible bars). (3) "Dashboard unavailable"
   headline scaled from 0.7rem eyebrow to text-xl font-semibold; amber-
   frame + red-text kept as the deliberate app-wide convention. (4)
   Attendance card gained "View check-ins" ghost link → /app/checkins (all
   three stat cards now drill down). (5) refresh banner renders the stored
   {refreshError} string + staleness timestamp — single source of truth.
   Test notes: 'renders attendance numbers' updated (Last 7 days gone,
   count ≥2, drill-down href asserted); accent test seeds a past-day
   check-in and asserts a muted #A3A3A3 history bar exists. Verified: full
   suite 278/278 (210 runnable + 68 skipped), 9 Dashboard tests,
   lint/tsc/build clean, detector 0. NEXT: remaining Dashboard items are
   P3 (skeleton morph, demo notice, confirmed timezone seam in mock repo
   bucketing); Members re-critique still pending; other surfaces never
   critiqued: Staff, Classes, Audit, MemberStatement, MyMembership.
- **v1.036** — audit sweep (user asked to check AUDIT.md before more
   critiques; verification found D2-residual fixed, C5 largely addressed
   by contact-info display, C6 stale after seed rewrite — AUDIT.md updated
   accordingly): (1) F3 — "Beta" badge removed from PageShell (contradicted
   the Profile version indicator); test inverted to assert absence. (2)
   D4 — MemberStatementPage rewritten: single try/catch over both mock and
   Supabase paths, silent mock-data fallback REMOVED, 'Member not found.'
   renders a distinct amber not-found notice ("They may have been removed,
   or you may not have access to their record"), other failures render the
   amber LoadError panel with connection copy; new test asserts the amber
   not-found state for an unknown member id. NOTE: both ledger repos throw
   'Member not found.' for missing/RLS-blocked members — the page
   distinguishes on that exact message. (3) C4 copy half — Check-ins quick
   list now says "Showing the 5 newest members" (listMembers sorts
   created_at DESC in both repos); frequency sorting stays future work.
   Verified: full suite 279/279 (211 runnable + 68 skipped), lint/tsc/
   build clean, detector 0. OPEN AUDIT ITEMS: A5 void_reason column, C1
   duplicate-check-in DB unique index, B5 renewal reminders, D5 server-side
   pagination, E1 password policy scope decision, E3 orphan profiles in
   staff list, F2 shared-state auto-dismiss, G1-G5 feature gaps — all need
   product/schema decisions or explicit approval.
- **v1.037** — audit C1 CLOSED with explicit user approval (schema change):
   migration `028_check_in_daily_unique.sql` adds an IMMUTABLE
   `public.manila_day(timestamptz)` helper (PH has no DST) and a UNIQUE
   index `check_ins_member_manila_day_unique` on `(member_id,
   manila_day(checked_in_at))`; pre-index dedupe keeps the earliest
   check-in per member/Manila-day (audit_log will record each removed
   duplicate via the delete trigger). `supabaseCheckInRepository`
   translates Postgres 23505 on insert back to "Already checked in today."
   New live integration test inserts twice DIRECTLY via the DB client
   (bypassing app guards) and asserts the second fails with code 23505;
   runs only with JYM_TEST_* env vars. Also: HANDOFF Product section now
   records project context (thesis-first, real-gym possible; deployed at
   jym-management-system.vercel.app; auth = Supabase email+password +
   signup email confirmation, NO per-login MFA in code), and AUDIT.md E1
   clarified accordingly. D5 (server-side pagination) explicitly deferred
   by user. Verified: full suite 279/279 (211 runnable + 68 skipped),
   lint/tsc/build clean, detector 0. NOTE: migration must be applied to
   the live DB (`supabase db push` or dashboard SQL editor) before the
   constraint is active in production.
- **v1.038** — docs housekeeping only: HANDOFF "What's next" §7 corrected
   (the #DC2626 claim was stale since the v1.027 revert; replaced with the
   accurate post-round-15 Check-ins state), PLAN.md status section now
   points at CHANGELOG.md as authoritative from v1.002 onward. No code.
- **v1.039** — critique round 1 (Staff page, FIRST review, scored 17/40 —
   weakest surface; user approved fixing all five): (1) P0 — silent mock
   fallback removed; load failures render the amber LoadError panel +
   Retry, mock only on the no-config dev path. (2) P0 — self-lockout
   blocked: new `getMyProfileId()` on StaffRepository (interface + mock
   null + Supabase via session user id = profiles.id) lets the page refuse
   demoting your own owner account and demoting the LAST owner ("promote
   another owner first"). (3) P1 — toUserError whitelist + console.warn;
   raw e.message gone. (4) P2/E3 — member-role accounts hidden by default
   behind an aria-pressed "Show member accounts" chip toggle. (5) P2 —
   inline select + window.confirm replaced by RowMenu ("Make staff/member/
   owner") + ConfirmModal with consequence copy, danger styling for owner
   downgrades, restoreFocusId to `staff-menu-<id>`. Tests rewritten (RowMenu
   flow, toggle, last-owner guard, amber load-error recovery with hoisted-
   config pattern; mocked repo data must use camelCase createdAt since the
   mapper is bypassed). Verified: full suite 283/283 (214 runnable + 69
   skipped), lint/tsc/build clean, detector 0. NEXT: Classes critique
   (never reviewed), then Activity log; B5 renewal reminders after.
- **v1.041** — critique round 1 (Activity log page, FIRST review, 17/40;
   user approved fixing all five, investigative tools scoped out with D5):
   (1) P0 — the mock fallback on the configured path is GONE: failed loads
   clear entries + render amber LoadError panel ("Couldn't load activity.
   Check your connection and try again.") with Retry; no-config demo mode
   keeps mock entries but now labels itself "Demo data — no live database
   connected." (role="status") like Dashboard. (2) P1 — raw e.message →
   console.warn only. (3) P2 — actionTone/actionLabel are exhaustive Records
   keyed to AuditEntry['action'] ('delete' | 'void' — verified via audit
   Repository.ts) with a verbatim fallback branch so unknown actions can
   never render invented verbs. (4) P2 — void tone neutral per UI_DESIGN.md
   colour table (delete stays red = documented severity choice). (5) Card
   description shows "N recorded actions." Test notes: new tests for demo
   label + amber-error-recovery (hoisted-config pattern); a loose /voided
   invoice/ regex matched the PageShell DESCRIPTION — anchor such regexes
   when page copy shares vocabulary. Verified: full suite 285/285 (216
   runnable + 69 skipped), lint/tsc/build clean, detector 0. NEXT: item 3
   of the agreed plan — B5 renewal reminders (needs two product decisions:
   warn window + placement), then item 4 F2+polish batch. ALL FOUR pre-
   viously-unreviewed surfaces have now had first critiques + fixes:
   Staff 17→fixed v1.039, Classes 19→fixed v1.040, Activity log 17→fixed
   v1.041.
- **v1.042** — audit B5 SHIPPED (user decisions: 3-day window, Dashboard
   banner): DashboardView gains expiringMembers (id/fullName/endsAt);
   SupabaseDashboardRepository queries memberships status='active' with
   ended_at between phDateInDays(0) and phDateInDays(3), embedding members
   (full_name) with the Array.isArray normalization; mock accepts the list
   via seed(). DashboardPage renders an amber #FFB300/#1A1A1A banner
   (role=status) between hero and Attendance card: names + ends dates + a
   View members link (duplicate link name with Membership card is expected
   — tests use getAllByRole). Already-expired members excluded; grace stays
   on Check-ins. AUDIT.md B5 → SHIPPED. Verified: full suite 287/287 (218
   runnable + 69 skipped), 11 Dashboard tests incl. banner shown/hidden,
   lint/tsc/build clean, detector 0. NEXT: item 4 of the agreed plan — F2
   (auto-dismiss messages) + check-ins P3 polish batch.
- **v1.043** — item 4, FINAL batch of the agreed plan: (1) F2 — success
   StatusLine auto-dismisses after 5s on Check-ins and Payments via a
   cleanup-timer effect; errors intentionally persist. (2) Tabs.tsx: full
   ARIA tabs keyboard pattern — ArrowLeft/Right move selection with wrap,
   focus follows, roving tabindex (inactive = -1); new Tabs.test.tsx (3
   tests incl. controlled-rerender focus-follow). (3) Check-ins MemberRow
   component extracted — the duplicated row JSX is gone. (4) unified search
   input autoFocuses on tab mount. (5) wrong PIN clears pinValue. (6)
   deleting the LAST remaining row focuses the page h1 (tabindex set
   dynamically) instead of <body>. Verified: full suite 292/292 (223
   runnable + 69 skipped), lint/tsc/build clean, detector 0. ALL FOUR
   AGREED ITEMS COMPLETE (docs housekeeping v1.038; four surface critiques
   + fixes v1.039-v1.041; B5 renewal reminders v1.042; this batch).
   Remaining open items all need explicit product/schema approval: A5
   void_reason, partial payments, PIN-bypassed flag, D5 server-side
   pagination, E1 password policy scope, G-series features.
- **v1.044** — re-critique sweep + copyright: all five sub-30 pages re-
   scored dual-agent after their fix waves — Check-ins 28→36 (round 16;
   remaining: three P2s — delete-refresh misreport, raw e.message in
   LoadError headline, empty-query Enter targeting), Members 26→33 (round
   7; remaining P1: silent create success), Classes 19→35 (round 2; the
   re-critique caught a real v1.040 gap — create-class success message —
   fixed immediately along with name-required and end>start validation;
   only P3s left), Activity log 17→33 (round 2; only P3s, filters scoped
   to D5), Staff 17→32 (round 2; only P3s). Every critiqued page now 30+.
   Also: CreditsFooter now reads "© Jairus Co. {year}". Verified: full
   suite 292/292 at v1.043 baseline before this docs/footer change; footer
   has no test coupling. SESSION CLOSE: v1.027→v1.044, every surface ≥30,
   audit C1+B5 closed, four previously-unreviewed surfaces brought up to
   standard.
- **v1.046** — systems-integration review items A2/A3/D2 shipped (review
   doc: docs/SYSTEMS_INTEGRATION_REVIEW.md): (A2) GitHub Actions CI at
   .github/workflows/ci.yml — lint + unit tests + build on push/PR; live
   integration tests still skip without secrets. (A3) docs/API_CONTRACTS.md
   — full ICDs for /api/create-login and /api/link-account (payloads, status
   matrices, side effects, rollback guarantee). (D2) docs/ARCHITECTURE.md
   rewritten: system-context + deployment mermaid diagrams and three
   sequence diagrams (sign-in→RLS, rpc_record_payment transaction,
   create-login service-role flow), cross-cutting decisions named. Also B2
   remediation shipped in v1.045 (credential scrub). REMAINING from the
   review: A1 contract tests for mock/live parity, A5/D5 capacity notes now
   documented in ARCHITECTURE.md, B3 rate-limit scope note, B5 observability.
- **v1.047** — tier-1 sweep closing all remaining actionable critique items:
   (1) Members create now confirms "<Name> added." green role=status with 5s
   auto-dismiss — closes the last open P1 across all critiques. (2) Check-ins
   delete path split like completeCheckIn: refresh failure after successful
   delete warns "Check-in deleted, but the list may be out of date." instead
   of claiming the delete failed. (3) Check-ins load/history LoadError copy
   fully humanized ('Check your connection and try again.'), raw e.message
   gone. (4) empty-query Enter refocuses search instead of arming first
   member. (5) test_rpc.json deleted; README rewritten for current feature
   set + doc links. LESSON: pause/resume tests hardcoded endsAt 2026-08-31
   and silently broke when the calendar entered the 7-day expiry window on
   Aug 24 — replaced with 2099 dates (match existing suites). Verified: full
   suite 294/294 (225 runnable + 69 skipped), lint/tsc/build clean, detector
   0. ALL actionable findings from every critique and the systems-integration
   review are now closed or explicitly parked.
- **v1.048** — tier-2 fixes (MyMembershipPage 19/40 and AuthPage 23/40, the
   two worst remaining surfaces; provider outage forced degraded single-
   context reviews — flagged in snapshots): MyMembership: amber LoadError +
   Retry, mock fallback removed on configured path (demo labeled like
   Dashboard), statusPresentation() maps real status to badge incl. amber
   Grace with dated message, expiring-soon amber notice. AuthPage:
   mapAuthError() filter (rate-limit/confirmation guidance, rest passes —
   Supabase auth messages are human), submit buttons disabled while loading
   + authButtonClass/authLinkButtonClass with focus rings, reset-mode title
   bug fixed ('Reset password' now shows), 'Phase 1'/'Authentication
   foundation'/env-var dev copy replaced with member wording, aria roles on
   error/status notices, check-email + reset-sent notices now amber. Tests:
   'Phase 1' assertion updated to new description copy. Verified: full suite
   294/294 (225 runnable + 69 skipped), lint/tsc/build clean, detector 0.
   EVERY user-facing surface now scored 30+ or fixed to standard.
- **v1.049** — systems-integration review B3/B5/A1 shipped: (B3) RLS.md
   documents accepted auth-throttling scope. (B5) lib/reportError.ts:
   installGlobalErrorReporting() wires window error/unhandledrejection at
   startup; reportError() logs + POSTs JSON to VITE_ERROR_WEBHOOK_URL when
   set (zero deps, inert until configured). (A1) src/repoParity.test.ts —
   shape-contract tests diffing mock vs Supabase outputs for members.
   listMembers and invoices.listInvoices via canned PostgREST rows through a
   fake thenable query chain (builder.then resolves; maybeSingle/single as
   promises). Pattern extends to other repos. Verified: full suite 296/296
   (227 runnable + 69 skipped), lint/tsc/build clean, detector clean.
- **v1.040** — critique round 1 (Classes page, FIRST review, 19/40; user
   approved fixing all five): (1) P0 — silent mock fallback removed;
   loadError state gates ALL page content behind one amber LoadError panel
   + Retry (Retry clears loadError then reloads current weekStart). (2)
   P0 — Delete class and Cancel booking now route through ConfirmModal
   (pendingConfirm {title,body,confirmLabel,danger,run} pattern);
   delete is danger-styled. (3) P1 — toUserError with BOOKING_DOMAIN_
   MESSAGES whitelist ('Session is at full capacity.' passes through) +
   console.warn. (4) P1 — success strings finally populated ('Class
   added.', '<Class> scheduled for this week.', '<Member> booked.',
   'Booking cancelled.'); success = green role="status", error =
   red role="alert". (5) P2 — cancelled bookings tone neutral (was bad),
   Book toggle aria-expanded. Test notes: cancel test walks the modal
   ("Cancel booking" confirm); a double-ternary JSX slip (`? A : (B) :
   null`) broke compile mid-edit — fixed to `? A : (B)` + separate null
   branch. Verified: full suite 283/283 (214 runnable + 69 skipped),
   lint/tsc/build clean, detector 0. NEXT: Activity log critique (last
   never-reviewed surface), then B5 renewal reminders, then F2+polish
   batch.
- **v1.025** — critique round 10 (Check-ins, first fix round; the fresh
   re-critique scored 29/40 — converging with the round-6 rerun's 29/40 —
   and the user approved all 4 P1s): search Enter no longer auto-checks-in
   the first match; the old "checks in the first matching member when the
   search form is submitted" test was replaced with one asserting submit
   does NOT check in and the row button still does. A Supabase load
   failure no longer silently swaps in mock data: `load()` clears the
   lists and renders a "Couldn't load check-in data." `LoadError` block
   with Retry in the Check in and Today tabs (demo mode with no DB config
   still uses mocks). New test "shows an error and Retry when Supabase
   load fails, then recovers" uses the hoisted-config pattern from
   DashboardPage.test with both supabase repos mocked — `listCheckIns`
   must also resolve, or `loadHistory` throws a spurious alert on mount.
   `dangerButtonClass` is now a red-bordered chip (fills solid on
   hover/focus-visible) instead of a red underline identical to the
   primary button — destructive is visually distinct app-wide
   (ConfirmModal + Delete rows). The QR overlay is a real dialog:
   role="dialog", aria-modal, describedby, Escape-close, Tab focus trap,
   focus restored to the "Scan QR" trigger (mirrors ConfirmModal). New
   QrScanner tests cover dialog semantics + focus restore; use
   `getAttribute` not `toHaveAttribute` (jest-dom matchers aren't
   registered). Verified: full suite 265/265 (197 runnable + 68 skipped),
   lint/tsc/build clean, detector 0 findings. Next: re-critique
   Check-ins (round 11) to confirm the score moved.
- **v1.024** — critique round 9 (Dashboard, final a11y polish): a failed
   refresh moves focus to the banner's Retry (`refreshRetryRef` + effect;
   it previously needed a backward tab). A failed Retry no longer yanks
   focus to the hero — `restoreFocusRef` is cleared in the load `catch`,
   so focus only returns to "Today" on success (was: focus moved to the
   hero AFTER the alert had already fired). "Updated HH:MM" is now
   `aria-live="polite"`, so refresh completion is announced. The Refresh
   button label swap no longer nudges the CTA (min-width + centered).
   `dangerButtonClass` focus-visible is no longer dead code — the
   underline is hidden by default (`after:scale-x-0`) and appears only on
   keyboard focus. Deliberately deferred: hard-coded hex tokens (repo-wide
   convention across every feature page; a cross-app refactor, not a
   Dashboard defect). Verified: full suite 262/262, lint/tsc/build clean,
   detector 0 findings. The Dashboard critique loop is plateauing
   (15 → 30 → 28 → 26 → this polish); remaining findings are P2 polish
   and token hygiene.
- **v1.023** — critique round 8 (Dashboard; the round-3 re-critique had
   scored 28/40 — down from 30 — because the refresh work introduced
   regressions, now fixed): Refresh no longer unmounts the whole dashboard
   (last-good numbers stay visible while re-fetching; the button shows
   "Refreshing…" and its disabled guard is now live instead of dead code).
   A failed refresh keeps the last-good data and shows an inline
   "Couldn't refresh — showing data from HH:MM." banner with Retry
   (was: `setView(null)` wiped the dashboard). Focus returns to the hero
   "Today" heading after a successful Refresh/Retry (was: fell to
   `<body>`). Refresh is hidden in demo mode (was re-stamping "Updated"
   over immutable mock data). Error card heading is "Dashboard
   unavailable" (was duplicating the h1). Chart got a visible
   `focus-visible` outline; `dangerButtonClass` matched its siblings.
   `load()` is now `useCallback`-wrapped with a `viewRef` so the
   refresh-vs-first-load error branch reads current state without
   re-running the mount effect. Test notes: new "keeps last-good data and
   shows an inline banner when a refresh fails" (resolve → reject →
   resolve mock chain). Verified: full suite 262/262, lint/tsc/build
   clean, detector 0 findings.
- **v1.022** — critique round 7 (Dashboard): the one-shot snapshot is
   gone — a Refresh button re-fetches and an "Updated HH:MM" caption
   shows when the numbers were last fetched. The chart no longer
   fabricates a stat on a fully zero week ("Peak" caption only renders
   when a peak day exists and is pluralized; bars scale to the real max).
   "This week" renamed "Last 7 days" (matches the rolling filter). The
   error state leads with friendly "Couldn't load the dashboard." and the
   raw Supabase detail is muted technical text; Retry now receives focus
   on error. Heading structure: hero "Today" + card titles are real `h2`s
   (SectionCard gained an optional `titleAs` prop, default `p` — the
   default is unchanged for other pages). Keyboard focus: ghost/primary/
   outline button classes + hero CTA got explicit `focus-visible:` states;
   the chart is keyboard-reachable (`tabIndex`). Verified: full suite
   261/261, lint/tsc/build clean, detector 0 findings.
- **v1.021** — critique round 6 (Dashboard, first round, score 15/40):
   the silent mock-data fallback is gone. When Supabase is configured but
   fails, `DashboardPage` shows a real error state + Retry button (mock
   zeros only when no database is configured, and then labeled "Demo
   data"). The bar chart got `role="img"` + a full per-day aria-label
   (today marked "so far"), per-column `title` tooltips, a "Peak: N
   check-ins in a day" caption, and a marker dot under today's column.
   Layout is front-desk first: a hero with today's count + the "Record a
   check-in" link as the visual primary, then the weekly chart, revenue,
   membership. Test notes: demo/error tests use a hoisted
   `hasSupabaseConfig` getter and a mocked `SupabaseDashboardRepository`
   (`rejectOnce` then `resolveOnce`). Verified: full suite green (261
   tests), lint/tsc/build clean, detector 0 findings. Dashboard critique
   snapshot: `apps-web-src-features-dashboard-dashboardpage-tsx` first run
   15/40 (trend file created).
- **v1.020** — critique round 5 P1 (user-approved): staff can void issued
   invoices, and the owner can undo a payment on a paid invoice. Migration
   `027`: `enforce_owner_only_actions` now allows owner OR staff to set an
   `issued` invoice to `void`, and blocks every other status→`void` write
   (a direct paid→void update would leave the money on the books); new
   SECURITY DEFINER `rpc_void_invoice(p_invoice_id)` — issued → `void`
   (staff+owner, audit trigger logs it), paid → owner-only undo (payment
   rows deleted, invoice back to `issued`, `paid_at` cleared,
   `undo_payment` audit row). `SupabaseInvoiceRepository.voidInvoice` now
   calls the RPC; the mock mirrors it (`MockPaymentRepository` gained
   `removePaymentsForInvoice`). UI: the row menu shows Void on
   issued/overdue rows for staff AND owner; paid rows show "Undo payment"
   (owner only) with its own confirm dialog copy. Payment methods stay
   Cash/GCash/Card/Bank (user decision — keep all four). Test notes: the
   live undo test creates its own invoice+payment (the shared paid invoice
   must survive for the later list test); staff role in component tests via
   `mockStaffRepository.setMyRole('staff')` before `renderPage()`.
   Verified: full suite green, lint/tsc/build clean, detector 0 findings;
   migration `027` applied live, `migration list` Local = Remote.
- **v1.019** — critique round 5 (Payments): no false failure on refresh.
   Issue/record/void now split the write from the refresh, and `load()`
   returns a boolean so callers can tell a failed refresh from a failed
   write — if the write succeeded but the refresh failed the page says
   "Invoice issued, but the list may be out of date — Retry to refresh."
   (same for record and void) instead of "Failed to…". (A retry after a
   fake failure could duplicate an invoice.) Role failures surface: a
   `getMyRole` failure shows "Couldn't verify your role — Void is
   unavailable." with a "Retry role" button instead of silently hiding
   Void. After recording a payment, focus lands on the Statement link
   (was `<body>`). Void focus fallback now targets the active filter chip
   by its aria-label `Filter: ${chip.label}` (the earlier selector used
   the lowercase filter id and never matched). The Issue form is disabled
   while loading/errored with a hint line. Test notes: the mock repo's
   `createInvoice` generates `INV-2026-0001`-style numbers, not `INV-1001`
   — assert with the returned invoice's `invoiceNumber`; `toBeDisabled`/
   `toBeEnabled` are NOT registered in this repo's vitest setup (use the
   `.disabled` property — and for the disabled fieldset check the
   `closest('fieldset')`'s `.disabled`, since the button's own property
   stays false under a disabled ancestor); `load()` swallows its errors
   internally (catch → `loadError`), so callers must use its boolean
   return, never try/catch around it.
- **v1.018** — critique round 4 (Payments, score 30/40, trend
   23→21→28→30): the payment panel closes when its invoice is voided (the
   row's Close toggle unmounts on void, so the panel was previously
   stranded with an enabled Confirm that would throw "Invoice is not
   payable."). Retry re-enters the loading state (`setLoading(true)` in
   `load()`'s Supabase path) — no stale error + double-click races. The
   Payments tab pagination footer moved inside the data branch (no "0
   results" beside "Loading…" or the load error). After a successful void,
   focus goes to the row's Statement link: the always-rendered Statement
   link carries `id={`invoice-statement-${invoice.id}`}` and
   `handleConfirmVoid` focuses it after the refresh (a ConfirmModal
   `fallbackFocusId` prop was tried first — the cleanup runs while the
   menu trigger still exists pre-refresh, so it wins and then dies with
   the row; handler-level focus after `load()` is the robust spot).
   Test notes: new "closes the payment panel when its invoice is voided";
   the void-success test asserts `document.activeElement` is the row's
   Statement link.
- Migrations: `001`–`013`, `016`, `018`, `019`, `024`–`026` all applied to the
   live project. (`014`, `015`, `017` were deleted + marked reverted.)
- Full suite: **255/255 (34 files)** including live integration tests. Build:
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
  `JYM_TEST_EMAIL=[test-owner-email redacted]`, `JYM_TEST_PASSWORD=[password redacted]`,
  `JYM_MEMBER_EMAIL=[test-member-email redacted]`, `JYM_MEMBER_PASSWORD=[password redacted]`
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
   analytics, kiosk mode, **partial payments** (accepting less than the full
   invoice total — needs product + schema/RPC decision, e.g. `paid_amount`
   column or split lines; parked after critique round 7, 2026-08-21).
5. **Critique round 5 — resolved 2026-08-19 (v1.020):** staff Void + paid-
   invoice undo shipped (migration `027`, `rpc_void_invoice`, owner-only for
   the paid undo). Payment methods: user decided to KEEP Cash/GCash/Card/
   Bank — do not restrict. Any remaining round-5 follow-up: a staff live
   account would let us live-test the staff-void path (unit/mock coverage
   only today; the live tests run as the owner).
6. **Critique round 6 (Dashboard) — shipped 2026-08-20 (v1.021):** P0
   (mock fallback), chart a11y, and front-desk reorder are done. Round 7
   (v1.022) closed the P1 stale-data gap (Refresh + "Updated"), the false
   Peak, bucket wording, and the a11y headings/focus items. Remaining
   known P2s: mock repo uses browser-local day buckets vs the live
   Asia/Manila buckets (demo mode only), and a future round could add a
   real "recent check-ins / who's in the building" list to the dashboard —
   that needs a repository extension (the dashboard repo currently only
   returns stats + weekly attendance).
7. **Critique rounds 10-11 (Check-ins) — shipped 2026-08-21 (v1.025,
   v1.026):** round 10 fixed all 4 P1s (safe search Enter, honest load
   error + Retry, distinct danger style, QR dialog); the round-11
   re-critique scored 31/40 (+2) and round 11 (v1.026) closed its two P1
   flow-blockers: the PIN dead-end now has a staff-confirmed "Member
   forgot PIN" override, and search Enter now focuses the first match's
   Check in button (still an explicit two-step, no auto-check-in).
   Status after rounds 12-15 (v1.027-v1.032, v1.035): the v1.026 danger
   split (#DC2626) was REVERTED app-wide to the vermillion ghost anatomy
   in v1.027; Enter got a visible 2px focus ring and can no longer
   dead-end; grace members render amber "Grace"; success copy is green;
   per-row Delete moved into RowMenu; the twin entry forms merged into
   one "Search or member ID" field; History got LoadError parity; write
   errors speak human copy; a recorded-but-unrefreshed check-in warns
   honestly. Still open (P3): keyboard arrow keys on Tabs, an "opening
   camera" scanning indicator, duplicated member-row JSX (extract a
   MemberRow component), autofocus on mount, PIN digit clearing after a
   wrong attempt, focus fallback when deleting the last row, sticky
   status messages, and the persisting "PIN bypassed" flag (schema
   change — deferred pending approval).

### ✅ v1.052 — schema & audit fixes (shipped 2026-09-05)
- **class_bookings** now has `updated_at` + `handle_updated_at()` trigger
- **class_bookings** unique constraint replaced with partial index `WHERE status <> 'cancelled'` — allows re-booking
- **Member deactivation** now logged to `audit_log` via `log_member_deactivation()` trigger
- **`memberships.status`/`ended_at` consistency** enforced via CHECK constraint
- **Migration sequence gaps** (007, 014, 015, 017) closed with placeholder files
- All minor items (#8, #9, #11, #13) from `AUDIT_FIXES.md` are now FIXED

### ✅ v1.053 — audit cleanup (shipped 2026-09-05)
- **`invoices.status` CHECK** — removed `'overdue'` enum value (nothing ever sets it; `is_overdue` handles this). Invalid rows auto-fixed.
- **Password change audit** — added `password_changed_at` column to `profiles` + `log_password_change()` SECURITY DEFINER trigger. `ProfilePage.tsx` and `PasswordResetCallback.tsx` set it after `supabase.auth.updateUser({ password })`. `audit_log` now captures password changes.

### Remaining (requires product decision)
- **#10**: Mixed temporal types (DATE vs TIMESTAMPTZ)
- **#12**: No soft-delete pattern
- **#7**: PIN verification non-constant-time comparison
- **#4**: `profiles`/`members` data redundancy (intentional design)

Deploy note for v1.005: before the live create-login path works, set
`SUPABASE_SERVICE_ROLE_KEY` in the Vercel project env (and confirm
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are already there — they are
used by the function too). In local dev the function isn't reachable (vite has
no `/api` route) — the mock path covers the UI; live verification needs
`vercel dev` or the deployed site.

Full audit (severity-tagged) in `docs/AUDIT.md`; strengths to defend:
database-enforced invariants, RLS + live tests, Manila timezone correctness.

## Verification commands (from `apps/web`)

- `npx vitest run` (with env vars above for full 250/250)
- `npm run build` (tsc -b + vite build)

## Key files

- `supabase/migrations/` — schema is authoritative; read before db work
- `apps/web/api/` — Vercel serverless functions (`create-login.ts` = B1)
- `apps/web/src/features/{members,checkins,payments,ledger,classes,staff,auth,membership,dashboard,memberAccounts}/`
- `apps/web/src/lib/dates.ts` — timezone helpers (`formatWhen`, `phDateAfter`, …)
- `docs/USER_FLOWS.md` — how the system is used (owner/staff/member scenarios)
