# Changelog

All shipped changes are tracked here with a version number. The version shown on the
Profile page (and in `apps/web/package.json`) always matches the latest entry below.
Every time a change ships, the version bumps (1.001 → 1.002 → 1.003, …) and a new
entry is added at the top of this file.

## v1.028 — Critique round 7 (Payments, 30 → 36, Excellent): two remaining P2s closed (2026-08-21)

- Round 7 re-critique scored the Payments page 36/40 (Excellent, up from
  30). The round-6 fixes were verified landed. Two P2s remained and are
  closed here:
  - The Payments tab still used the run-on dot-separated meta line
    (`GCash · REF-123 · INV-009 · Aug 21, 10:14 AM · taken by Ana`) that
    had been excised from the Invoices tab. Rows now mirror the Invoices
    anatomy: member name title, method · reference · invoice number on
    line two, paid datetime · taken-by on line three, mono amount
    right-aligned. Both tabs now speak the same rhythm.
  - The exact-amount payment rule was a silent wall: the panel disabled
    Confirm on any mismatch but never stated the policy until the user
    broke it. The Record payment panel now opens with a calm one-line
    hint, "Payment must equal the invoice total of ₱…". The hard guard
    and the red "Must equal ₱X" mismatch hint are unchanged. (Full
    partial-payment support remains a parked product decision — it needs
    a schema/RPC change and explicit approval; noted in HANDOFF.)
- Verified: full suite 269/269 (201 runnable + 68 skipped live DB), 27
  Payments tests, lint/tsc/build clean, detector 0 findings.

- Round 6 dropped Payments from 34 → 30: v1.026's #DC2626 danger split and
  the Outstanding figure rendered in error-red were both live on screen.
  Both P1s are fixed here:
  - Outstanding is no longer red. A total owed is money, not an error — it
    now renders in paper #FAFAFA; only the Overdue count keeps vermillion.
  - The danger split is reverted. `dangerButtonClass` returns to the
    vermillion ghost anatomy (relative, px-1 py-2, text-[#FF3D00], after
    underline) so Delete/void no longer have two competing reds. The
    `#DC2626` token is removed; `docs/UI_DESIGN.md` now documents danger as
    the same accent — one voice, ghost anatomy, NOT a distinct color. (This
    reverses the v1.026 "distinct danger color" change; the round-6 finding
    was that a second off-palette red failed AA contrast and split the
    voice.)
- Issue-invoice form now collapses behind a "New invoice" button
  (list-first): the Invoices list is the default view, the form opens on
  demand with a Cancel escape, and the empty state points to "New invoice".
- Invoice and payment rows are restructured into two-line cards: member
  name is the title (with status badge), the run-on dot-separated meta is
  now `number · plan · issued · due · paid` (dates, not datetimes, fixing
  the precision mismatch), and the amount moves to a right-aligned
  font-mono ₱ figure instead of being embedded mid-sentence.
- Added a search filter (member name or invoice number) above the status
  chips; search and filter compose, the page resets on either change, and
  the empty state distinguishes no-invoices vs no-filter-match vs
  no-search-match.
- The "Collected by staff" box drops its filled panel for hairline
  separators (consistent with the rest of the list anatomy).
- Partial-payment handling (amount ≠ total) deferred — investigated later,
  parked in HANDOFF. No schema changes were made this round.
- Verified: full suite 269/269 (201 runnable + 68 skipped live DB), 27
  Payments tests incl. 2 new (collapse behavior, search), lint/tsc/build
  clean, detector 0 findings.

- The PIN gate no longer strands a member at the counter. The prompt now
  explains why the PIN is asked, and a "Member forgot PIN" link opens a
  staff-confirmed override ("Check in anyway? This bypasses the PIN
  verification.") that completes the check-in instead of silently
  bypassing the gate. (The override currently records a normal check-in;
  persisting a "PIN bypassed" flag would need a schema change on
  `check_ins` — deferred, documented in HANDOFF.)
- The search form's dead Enter is now a keyboard fast path: submitting
  the search form focuses the first match's "Check in" button. It does
  NOT check in — each Enter is still a deliberate, explicit step, so the
  round-10 safety fix is preserved. Staff processing a line of
  name-searchers can now type, Enter, Enter instead of reaching for the
  mouse every time.
- Destructive actions are now a distinct red. `dangerButtonClass` switches
  from #FF3D00 to a dedicated #DC2626 danger token, so Delete/void no
  longer compete with the brand accent, error text, and badges for the
  same red. Documented as a new `danger` token in `docs/UI_DESIGN.md`;
  the repo-wide hex-to-token extraction stays deferred.
- Verified: full suite 267/267 (199 runnable + 68 skipped live DB),
  lint/tsc/build clean, detector 0 findings.

## v1.025 — Critique round 10 (Check-ins): first P1 fix round — safe search Enter, honest load errors, distinct danger style, QR as a real dialog (2026-08-21)

- Pressing Enter in the member search no longer checks in the first
  match. Submitting the search form previously recorded a check-in with
  no confirmation, so mashing Enter after typing a partial name could
  silently check in the wrong person. Enter now only submits the
  (already-prevented) form, and recording a visit requires the row's
  explicit "Check in" button. The recent-members hint now says to press
  Check in.
- A Supabase load failure no longer silently swaps in mock data: the
  page clears the lists and shows "Couldn't load check-in data." with
  the real reason and a Retry button in both the Check in and Today
  tabs. Demo mode (no database configured) still uses the seeded mock
  data and is unchanged — this closes the same honesty gap the Dashboard
  closed in v1.021 (a screen full of fake members after a DB outage
  would let staff "check in" people who don't exist).
- Destructive actions now look destructive. `dangerButtonClass` is no
  longer a red underline identical to the primary button: it is a
  red-bordered chip that fills solid on hover/keyboard-focus, so Delete
  is clearly distinct from Check in everywhere it is used — check-in
  rows, delete confirmations, and every other confirm modal in the app.
- The QR scanner is now a real dialog: `role="dialog"`, `aria-modal`,
  a described-by description, Escape-to-close, a Tab focus trap, and
  focus returns to the "Scan QR" button when it closes. Cancel
  auto-focuses and uses the shared outlined button (with a visible
  keyboard-focus state) instead of a bespoke class; the camera preview
  has an accessible name.
- Verified: full suite 265/265 (197 runnable + 68 skipped live DB),
  lint/tsc/build clean, detector 0 findings.

## v1.024 — Critique round 9 (Dashboard): final a11y polish — banner focus, no focus yank on failed retry, refresh completion announced (2026-08-20)

- A failed refresh now moves focus to the banner's own Retry button (it
  previously required a backward tab to reach); a failed Retry no longer
  yanks focus to the hero "Today" heading after the alert has fired —
  focus is only restored on success.
- The "Updated HH:MM" caption is now an `aria-live="polite"` region, so
  a screen-reader user hears when a refresh completes instead of nothing.
- The Refresh button's label swap ("Refresh" → "Refreshing…") no longer
  nudges the adjacent "Record a check-in" link (fixed width).
- `dangerButtonClass` focus-visible is no longer dead code: its underline
  is hidden by default and appears only on keyboard focus (it was
  declared to scale on focus but had no underline base to scale).
- Deliberately deferred (documented in HANDOFF): extracting hard-coded
  hex literals into design tokens — that is a repo-wide convention in
  every feature page, not a Dashboard-specific defect, and would be a
  cross-app refactor.
- Verified: full suite 262/262 (194 runnable + 68 skipped live DB),
  lint/tsc/build clean, detector 0 findings.

## v1.023 — Critique round 8 (Dashboard): refresh no longer blanks the screen or loses data, focus survives reload (2026-08-20)

- Refresh no longer unmounts the whole dashboard: the page keeps showing
  the last-good numbers while it re-fetches, and the Refresh button itself
  switches to "Refreshing…" and is disabled during the load (previously
  the disabled guard was dead code — the button only rendered after
  loading finished, and every refresh flashed a full-screen loading card).
- A failed refresh no longer destroys good data: instead of wiping the
  dashboard to the error card, the page keeps the last-good view and shows
  an inline "Couldn't refresh the dashboard — showing data from HH:MM."
  banner with its own Retry.
- Focus survives reload: after a successful Refresh or Retry, focus
  returns to the hero "Today" heading instead of falling to `<body>`.
- Refresh is hidden in demo mode — it previously re-stamped "Updated"
  over immutable mock data.
- The error card heading is now "Dashboard unavailable" (it was duplicating
  the page h1 "Dashboard"); the keyboard-reachable chart gained a visible
  `focus-visible` outline; `dangerButtonClass` matches its siblings with a
  `focus-visible` state.
- `load()` is wrapped in `useCallback` with a view ref so the
  refresh-vs-first-load error decision reads the current view without
  re-running the mount effect (and satisfies the hooks lint rule).
- Verified: full suite 262/262 (194 runnable + 68 skipped live DB),
  lint/tsc/build clean, detector 0 findings.

## v1.022 — Critique round 7 (Dashboard, 30 → higher): refresh control, honest Peak, h2 structure, focus a11y (2026-08-20)

- The dashboard is no longer a one-shot snapshot: a Refresh button
  re-fetches on demand and an "Updated 8:42 AM" caption shows when the
  numbers were last fetched (P1 stale-data gap closed).
- The chart no longer fabricates a stat on an empty week: the "Peak"
  caption only renders when there was actually a peak day, and is
  pluralized ("Peak: 1 check-in in a day" vs "…check-ins…"). Bar heights
  scale to the real max instead of a forced 1.
- "This week" renamed to "Last 7 days" to match the actual rolling
  7-day filter (calendar-week vs rolling mismatch gone).
- The error state now leads with a friendly "Couldn't load the
  dashboard." and shows the raw Supabase detail only as muted technical
  text; the Retry button receives focus when the error appears.
- Headings: the hero "Today" and the Attendance/Revenue/Membership card
  titles are now real `h2`s (SectionCard gained an optional `titleAs`
  prop, default `p`), so a screen-reader user can jump between sections.
- Keyboard focus: ghost/primary/outline button classes and the hero CTA
  gained explicit `focus-visible:` states (previously hover-only
  affordances); the chart is now keyboard-reachable (`tabIndex`).
- Verified: full suite 261/261 (193 runnable + 68 skipped live DB),
  lint/tsc/build clean, detector 0 findings.

## v1.021 — Critique round 6 (Dashboard): no fabricated data, a chart that speaks, front desk first (2026-08-20)

- The fake-data fallback is gone: when Supabase is configured but
  unreachable, the page now shows a real error state with a Retry button
  instead of silently swapping in zeros from the mock repo. Demo data only
  appears when no database is configured at all, and is then labeled with
  a "Demo data" notice.
- The bar chart is now accessible and readable: `role="img"` on the chart
  with a full aria-label ("Mon: 12, Tue: 8, … so far" for today), a
  `title` tooltip per column, a "Peak: N check-ins in a day" caption, and
  a marker under today's column so "today is in progress" is both visible
  and audible.
- Front desk first: the page leads with a hero — today's check-in count
  plus the "Record a check-in" action as the visual primary — with the
  weekly chart, revenue, and membership below. The duplicate bottom CTA
  is gone.
- Verified: full suite 261/261 (193 runnable + 68 skipped live DB tests),
  lint/tsc/build clean, detector 0 findings. Dashboard critique snapshot:
  first round 15/40 (Poor); trend file created.

## v1.020 — Critique round 5 (user-approved): staff can void issued invoices, owner can undo a payment (2026-08-19)

- Migration `027` + new `rpc_void_invoice`: staff can now void *issued*
  invoices (the owner-only trigger relaxes to owner OR staff for
  issued → void), and the owner can undo a wrong payment on a *paid*
  invoice — the payment rows are deleted, the invoice returns to
  issued, `paid_at` clears, and an `undo_payment` row lands in
  `audit_log`. Direct paid → void updates stay blocked for everyone, so
  money can never be written off without removing the payment record.
- `SupabaseInvoiceRepository.voidInvoice` calls the RPC; the mock mirrors
  the RPC (undo removes payment rows via the new
  `MockPaymentRepository.removePaymentsForInvoice`).
- UI: issued/overdue rows show the Void menu for staff AND owner (was
  owner-only); paid rows show "Undo payment" for the owner with its own
  confirmation copy ("The payment record is removed and the invoice
  returns to issued.") and success message.
- Payment methods remain Cash / GCash / Card / Bank (deliberate user
  decision — the gym may take other methods later; documented in HANDOFF).
- Verified: full suite 259/259 (34 files, 191 runnable + 68 skipped live
  DB tests), live payments suites 15/15 against the real DB, lint/tsc/
  build clean, detector scan 0 findings, migration `027` applied live
  (Local = Remote).

## v1.019 — Critique round 5 (Payments): no false failure on refresh, role errors surface, honest void/issue/record under refresh failure, focus lands after every action (2026-08-18)

- The "failed to record/issue" lie is gone: issuing, recording, and voiding
  now separate the write from the refresh. If the write succeeds but the
  follow-up refresh fails, the page says exactly that — "Invoice issued,
  but the list may be out of date — Retry to refresh." (and the same for
  record and void) instead of claiming the payment/invoice failed. Retrying
  the write could previously duplicate an invoice that actually succeeded.
- `load()` now reports success/failure (returns boolean) so callers can
  distinguish a failed refresh from a failed write.
- Role lookup failures surface instead of silently locking out Void: if
  `getMyRole` fails, the Invoices card shows a "Couldn't verify your role —
  Void is unavailable." alert with a "Retry role" button instead of hiding
  the Void actions with no explanation.
- After recording a payment, focus lands on the paid invoice's Statement
  link (previously focus fell to `<body>` after the panel closed).
- Void focus fallback fixed: when the voided row leaves a filtered list,
  focus restores to the active filter chip (the selector now uses the
  chip's display label, matching its aria-label — previously the lowercase
  filter id never matched and focus fell to `<body>`).
- The Issue form is disabled during loading and while the load failed, with
  a hint line ("Loading members and plans…" / "Members and plans are
  unavailable while the load failed.") instead of letting the owner submit
  against an empty member/plan picker.
- Verified: Payments suite 23/23, full suite 255/255 (34 files, 187 runnable
  + 68 skipped live DB tests), lint/tsc/build clean, detector scan 0
  findings.

## v1.018 — Critique round 4 (Payments): no stuck panel after void, retry shows loading, honest pagination footer, focus survives void (2026-08-18)

- The payment panel can no longer get stranded: if the owner opens the
  inline panel and then voids that same invoice, the panel closes with the
  void (previously the row's Close control unmounted while the panel stayed
  open and would throw "Invoice is not payable." on submit).
- Retry now re-enters the loading state (`setLoading(true)` at the top of
  the Supabase load path), so a retry shows the loading state, hides the
  stale error, and can't be double-clicked into overlapping requests.
- The Payments tab's pagination footer moved inside the data branch — no
  more "0 results" next to "Loading…" or next to the load error (the
  invoices tab already scoped it this way).
- After a successful void, focus lands on the voided row's Statement link
  instead of `<body>`: the row's Statement link now carries a stable id and
  the void handler focuses it once the refresh completes (the modal
  cleanup alone can't win — its primary target, the menu trigger, still
  exists until the refresh lands, then dies with the voided row).
- Verified: full suite 252/252 (34 files, 184 runnable + 68 skipped live DB
  tests), lint/tsc/build clean, detector scan 0 findings. Critique score
  30/40 (trend 23 → 21 → 28 → 30).

## v1.017 — Critique round 9: honest Summary, home-scoped feedback, void focus restore, payment panel semantics (2026-08-18)

- The Summary strip no longer pretends to know money it doesn't: while
  loading (or when the Supabase load failed) the three figures show an
  em-dash instead of a fabricated "₱0.00 Outstanding" — the strip only
  commits to numbers once the data actually loaded.
- Feedback is home-scoped: a create error no longer gets displayed inside
  the Invoices card's status line and a record/void error no longer appears
  in the Issue card. Each card only shows feedback about its own work
  (issue card vs invoices card), and the stray StatusLine in the Payments
  card is gone.
- Void confirmation restores focus to the row's "…" menu trigger via a new
  optional `restoreFocusId` prop on ConfirmModal (the old code restored
  focus to a just-unmounted element and landed on `<body>`).
- The payment panel is now a real `<form>` with `aria-label="Record
  payment"`: Enter submits, the amount field autofocuses when the panel
  opens, Confirm is disabled while the amount is empty, the row toggle
  exposes `aria-expanded`/`aria-controls` and locks while a payment is in
  flight, the mismatch hint is wired with `aria-invalid` +
  `aria-describedby`, and the void menu item is disabled while a void is
  pending.
- Verified: full suite 251/251 (34 files, 183 runnable + 68 skipped live DB
  tests), lint/tsc/build clean, detector scan 0 findings.

## v1.016 — Critique round 8: Payments void dialog, honest failures, real success feedback (2026-08-18)

- Voiding an invoice now uses the shared ConfirmModal (danger variant) with
  focus restore, in-dialog pending ("Voiding…") and in-dialog error instead
  of the browser `window.confirm` — a 5-line "can we really void money"
  moment is now an unskippable, accessible confirmation. The two tests that
  spied on `window.confirm` now drive the real dialog (confirm + cancel
  paths, plus the dialog body's "cannot be undone" copy).
- Success feedback actually fires now: issuing an invoice, recording a
  payment, and voiding each announce ("Invoice issued." / "Payment
  recorded." / "Invoice INV-… voided.") in `role="status"` live regions
  inside the working cards. Previously `setSuccess` was never assigned —
  success was structurally impossible.
- In Supabase mode a failed load no longer silently falls back to fabricated
  mock money: the page shows the real error with a Retry button and stays
  honest (no fake invoices/payments, no lying "No payments yet"). Members'
  Retry pattern, applied here.
- The row-level "Record payment" button is demoted to ghost styling — only
  the confirm payment button inside the panel is primary (One Voice Rule;
  previously 15 vermillion CTAs at row scale).
- The void menu trigger now passes its `id` to RowMenu, so closing the menu
  restores focus to the trigger instead of `<body>`.
- Member select recall: the member stays selected after issuing an invoice
  (front desk usually issues several invoices to one member in a row), and
  member options are sorted by name.
- Verified: full suite 250/250 (34 files, 182 runnable + 68 skipped live DB
  tests), lint/tsc/build clean, detector scan 0 findings.

## v1.015 — Critique round 7: feedback at the action, modal focus, Enter-to-check-in (2026-08-18)

- Success/error feedback moved out of the page top into the card the user is
  working in, and the two can no longer coexist: setting one clears the
  other (a refresh failure after a successful check-in no longer stacks
  white + vermillion text). Live regions (`role="status"` / `role="alert"`)
  are preserved.
- ConfirmModal restores focus to the triggering control when it closes
  (cancel, Escape, backdrop, or success) — keyboard and screen-reader users
  no longer land on `<body>` after a delete/pause/activate dialog. Shared
  fix: Members and Check-ins both benefit.
- Enter now does the work: submitting the member search checks in the first
  match, and the QR/member-ID field is a real form so Enter checks in via QR.
- "Check in via QR" demoted to a ghost button — scanning is the single
  vermillion path, honoring the One Voice Rule.
- "Checked in today" is now a proper green status badge next to the member's
  name (per the Status Quartet) instead of a disabled 50%-opacity ghost
  button at sub-AA contrast.
- Verified: full suite 249/249 (34 files, live DB tests included);

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