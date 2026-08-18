---
target: apps/web/src/features/payments/PaymentsPage.tsx
total_score: 30
max_score: 40
na_heuristics: 0
p0_count: 0
p1_count: 1
timestamp: 2026-08-18T09-01-38Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Payments Page — Critique Round 4 (re-critique after v1.017)

- **Score: 30/40** — trend: 23 → 21 → 28 → **30**
- **Date:** 2026-08-18
- **Detector:** exit 0, `[]` findings
- **Reviewers:** A (general agent `ses_febede18fffeXftZcaYo1Ku3Cd`) — 4 findings; B (`ses_febedcd16ffeetrfWIlxtSTw0u`) — no findings reported.

## Findings (all shipped in v1.018)

### P1 — Payment panel gets stuck open when its invoice is voided
- **Location:** `PaymentsPage.tsx` — panel gated on `paymentFor` (line ~541) vs row controls gated on issued/overdue status (line ~503).
- **Issue:** If the owner opens the inline payment panel and then voids that invoice via the row menu, the voided row's "Record payment"/"Close" toggle unmounts, but the panel stays rendered (gated only on `paymentFor`). The panel has no Close control left, no Escape handling, and its Confirm stays enabled — submitting throws the raw repository error "Invoice is not payable." right after the user saw "Invoice … voided."
- **Fix:** In `handleConfirmVoid`'s success path, close the panel if it belongs to the voided invoice (`setPaymentFor(null)` + clear amount/reference).

### P2 — Retry does not re-enter the loading state
- **Location:** `PaymentsPage.tsx:132-162` (load) + Retry buttons (lines ~441, ~649).
- **Issue:** `load()` never calls `setLoading(true)` (loading is only seeded from `hasSupabaseConfig`), so during a retry the card keeps showing the stale error and an enabled Retry button — no progress feedback, and the button can be clicked repeatedly to fire overlapping requests.
- **Fix:** `setLoading(true)` at the top of the Supabase path in `load()` (after the mock early-return), so the cards render their loading state during retry.

### P2 — Payments tab pagination footer renders during loading and error
- **Location:** `PaymentsPage.tsx` — footer at old lines 695-719 sat outside the loading/error/data ternary.
- **Issue:** "0 results" appeared next to "Loading…" and next to the load-error state; the invoices tab correctly scopes its footer to the data branch.
- **Fix:** Moved the footer inside the data branch (same position as the invoices tab).

### P2 — Focus lands on `<body>` after a successful void
- **Location:** `PaymentsPage.tsx` ConfirmModal usage; row markup.
- **Issue:** After a successful void, the focus-restore cleanup resolves `invoice-menu-<id>`, but the menu unmounted when the invoice became voided — and the `savedFocusRef` fallback (the Void menuitem) unmounted too, so focus fell to `document.body`. The cancel path is fine (trigger survives).
- **Fix:** Give the row's always-rendered Statement link a stable `id` (`invoice-statement-<id>`) and, after the refresh completes in `handleConfirmVoid`, focus it explicitly. (A ConfirmModal `fallbackFocusId` prop was tried first, but the cleanup runs while the menu trigger is still alive pre-refresh, so the primary target wins and dies on refresh — the handler-level focus after `load()` is the robust spot.)

## Tests added/changed (20 total in PaymentsPage.test.tsx, suite 252 total)

- New: "closes the payment panel when its invoice is voided".
- Void-success test now asserts `document.activeElement` is the row's Statement link after confirming.
- Existing void-cancel focus test unchanged (trigger still survives on cancel).

## Verified

- `npx vitest run`: 184 passed, 68 skipped, 0 failed (252).
- `npx eslint … --max-warnings=0`: clean.
- `npx tsc -b` + `npx vite build`: clean.
- Detector: `[]`.
