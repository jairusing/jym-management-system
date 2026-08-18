---
target: Payments page re-run
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-18T08-32-24Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Payments Page — Design Critique Round 3

Method: dual-agent (A: ses_fec02775cffeE7AUdB3WALuWX0 · B: ses_fec0266f9ffegr5EfIzaGb1CTp)

Target: `apps/web/src/features/payments/PaymentsPage.tsx` (+ RowMenu, ConfirmModal, buttonClasses, SectionCard, Tabs, StatusBadge)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live regions + pending labels fixed; Summary shows "₱0.00 Outstanding" pre-load and during load failure |
| 2 | Match System / Real World | 3 | GCash/PHP/Manila/"taken by" are domain-true; equality rule never stated upfront |
| 3 | User Control and Freedom | 3 | Modal autofocuses Cancel, Escape/backdrop blocked while pending; no undo, Prev/Next-only paging |
| 4 | Consistency and Standards | 3 | Status quartet, tokens, Tabs consistent; chip selected state has no spec basis |
| 5 | Error Prevention | 3 | Amount-mismatch guard is best-in-app; empty amount leaves Confirm enabled |
| 6 | Recognition Rather Than Recall | 3 | Member persists after issue; no search in selects; method resets to cash |
| 7 | Flexibility and Efficiency | 2 | Plan prefill fast path; payment panel isn't a form (Enter dead), no page jump, no search |
| 8 | Aesthetic and Minimalist | 3 | Rows quieter now; two vermillion summary figures; dense middot-chained meta lines |
| 9 | Error Recovery | 3 | Retry real, in-modal error works; StatusLine renders 2–3× per failure, success never dismisses |
| 10 | Help and Documentation | 2 | Actionable empty states; void semantics and Outstanding definition unexplained |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

**Authored, with a thin generic shell.** The money vocabulary is genuinely local: `en-PH` currency, GCash as a first-class method, Manila timezone bucketing, staff "taken by" attribution with today-vs-month breakdown, plan auto-renewal, record-only framing in the page description. No category-interchangeable CRM template survives that test. Leaks: the three-stat summary strip, tabbed list layout, and "Statement" link are stock dashboard furniture; the summary shows zeros before data exists — an authored page would know its own emptiness is untrustworthy.

**Deterministic scan:** exit 0, `[]` findings across all four scanned files. Manual static pass confirmed: no `window.confirm` remains; live regions present (`role="alert"` / `role="status"`); per-invoice RowMenu ids; token-palette-only colors; pending states disabled; modal/menu keyboard support (Escape, trap, focus restore). Static pass surfaced a payment-panel a11y cluster the design review missed (aria-expanded missing on the toggle, mismatch hint not wired via `aria-describedby`, no `aria-invalid`, "Close" clickable mid-flight, void menuitem not disabled during pending). One false positive: B claimed the danger modal autofocuses the destructive button; it actually autofocuses **Cancel** (ConfirmModal.tsx:100) — the round-2 design intent is intact.

**Visual overlays:** not available — no browser tool in this environment (skipped with reason).

## Overall Impression

The six round-2 fixes are all present and the page now behaves honestly: void is a real in-house ceremony, success actually fires, failures show Retry instead of fabricated money. The remaining problems are the two ends of the page: the Summary strip at the top still lies (zeros before data, zeros during outage), and the feedback loop at the bottom still double-prints every message because the StatusLine landed in *all* cards instead of *the* card.

## What's Working

1. **Amount-mismatch guard** — the app's best micro-interaction: anticipates the desk's dominant error, pre-empts with a disabled confirm + inline vermillion hint.
2. **Honest failure path** — Supabase error + Retry, in-modal void error, no silent mock fallback. Round 2's lie is dead.
3. **Authored money domain** — GCash, en-PH, Manila month bucketing, staff collection attribution, plan auto-renewal. This is a Filipino gym's desk, not a generic ledger.

## Priority Issues

### [P1] Summary strip lies during load and outage
- **What**: "₱0.00 Outstanding" (vermillion — the most urgent color on the page) and "0 overdue" render from empty state while loading and after a load failure; the honest error + Retry sits below the fake zeros.
- **Why it matters**: The desk's first glance at the money picture is the least trustworthy number on screen — exactly when the desk needs truth (and round 2's "never fake money" principle, which the list now honors but the Summary still violates).
- **Fix**: Render a placeholder ("—" or a skeleton) until data loads; when `loadError` is set, replace the summary values with the same "—" (or hide the card) so the first fold never fabricates a balance.
- **Suggested command**: /impeccable harden

### [P1] StatusLine duplicates across cards
- **What**: Page-global `error`/`success` renders in both the Issue card and the Invoices card (and the Payments card); a void failure announces twice, a payment success twice.
- **Why it matters**: Round 7's principle was "feedback at the action" — here it's feedback everywhere. Screen readers hear every result twice; the success ending is diluted into noise competing with the row turning green.
- **Fix**: Scope feedback to the action's home card — issue/validation errors in the Issue card, record/void results in the Invoices card (a single StatusLine per tab).
- **Suggested command**: /impeccable clarify

### [P2] Focus restore broken on the void path
- **What**: ConfirmModal captures `document.activeElement` at mount; for void, that is the just-unmounted RowMenu menuitem, so restore targets a detached node and lands on `<body>`.
- **Why it matters**: The round-7 focus-restore fix exists but this path bypasses it — keyboard/SR users lose their place after the highest-stakes action on the page.
- **Fix**: ConfirmModal accepts an optional `restoreFocusId`; void passes `invoice-menu-${invoice.id}` (the trigger that stays mounted).
- **Suggested command**: /impeccable audit

### [P2] Payment panel semantics (detector cluster)
- **What**: The record-payment panel is a `div`, not a form — Enter is dead after typing a reference; no autofocus into Amount; empty amount leaves "Confirm payment" enabled to error on click; the toggle button lacks `aria-expanded`; the mismatch hint isn't `aria-describedby`-wired and the amount input never gets `aria-invalid`; "Close" stays clickable mid-request; void menuitem ignores `voidPending`.
- **Why it matters**: The desk's highest-frequency task has dead keys and unannounced state; Sam hears nothing when the hint appears.
- **Fix**: Convert the panel to a `<form>` (Enter submits), autofocus Amount, disable Confirm on empty, wire `aria-expanded`/`aria-controls` + `aria-invalid`/`aria-describedby`, disable the toggle while `paying`.
- **Suggested command**: /impeccable audit

### [P3] Chip row and selected-state tokens
- **What**: 5 invoice filter chips exceed the ≤4-option rule; the chip selected state has no spec basis in UI_DESIGN.md.
- **Fix**: Fold "Void" into the count strip or keep 5 deliberately; define the chip token in UI_DESIGN.md.
- **Suggested command**: /impeccable layout

## Cognitive Load Assessment

Checklist failures: **single focus** (issue form and invoice list compete in one view), **visual hierarchy** (gray 14px middot chain flattens 6 facts per row), **minimal choices** (5 filter chips; plan select unbounded). 3 failures = moderate load; the rest of the checklist passes (chunking, grouping, one thing at a time, working memory, progressive disclosure).

## Emotional Journey

- Void is genuinely reassuring now: in-house modal, "This cannot be undone," Cancel pre-focused, "Voiding…" pending, in-modal error, focus restore — the strongest moment on the page.
- The mismatch guard is the right peak for record payment.
- Peak-end defect: success at the end of recording prints twice with no amount or member context, competing with the row turning green.
- The lying opening: vermillion ₱0.00 while loading is the exact opposite of reassurance.

## Persona Red Flags

- **Alex (owner/power user)**: Prev/Next-only paging across 100+ invoices with no search or jump; plan select unsorted by price; payment panel Enter dead; no per-member outstanding rollup.
- **Sam (screen reader/keyboard)**: duplicate StatusLine = double announcement of every result; focus drops to body after voiding; mismatch hint not announced (no aria-describedby); tablist has no arrow-key roving.
- **Riley (money stress tester)**: pre-load and outage zeros pass as real at the top of the page; GCash reference is unvalidated free text; no staleness timestamp or refresh affordance.

## Minor Observations

- Success lines lack context — "Payment recorded." carries no amount or member; "Invoice INV-… voided." is the good exception.
- Method resets to cash every panel open (repeat-GCash desks re-pick).
- Plan options omit duration ("Monthly Pass — ₱1,500").
- Payment panel has no "Total due" line; the hint only appears after typing a mismatch.
- Tabs lack aria-controls and arrow-key roving.
- Outstanding (vermillion sum) and Overdue count (vermillion) side by side in one card.
- "This cannot be undone" on void has no equivalent at the record-payment moment (also irreversible).
- Green "Collected this month" uses the raw `#22C55E` token inline instead of StatusBadge — borderline, per spec status colors flow through StatusBadge.

## Provocative Questions

1. If the row turning green is the real feedback, why does the page still print "Payment recorded." — twice? Is the success line serving the desk or the design system?
2. The page's most urgent color claims "₱0.00 Outstanding" while loading — what would the desk do differently at 10am on day one if that number were honest about its own emptiness?
3. The equality rule protects the ledger but blocks the real-world half-payment — is the "must equal" guard protecting the desk, or protecting the model from the gym?
