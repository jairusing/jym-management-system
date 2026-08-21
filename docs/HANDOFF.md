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
   Remaining P2s: danger/error color is now distinct (#DC2626); still
   open are keyboard arrow keys on the tabs, no "opening camera" scanning
   indicator, duplicated list markup, focus restore after manual
   check-in, sticky status messages, and a persisting "PIN bypassed"
   flag (needs a schema change — deferred pending approval).

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
