---
target: Payments page round 7
total_score: 36
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
p2_count: 2
p3_count: 3
timestamp: 2026-08-20T17-51-04Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Payments Page — Critique Round 7 (v1.027)

Method: dual-agent (A: ses_fdfb78685ffeWMf7Yc9R48j35E · B: ses_fdfb77667ffeHCFTE04rVGgpLc)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Solid — loading→"—", pending labels, write-then-refresh messaging, count-bearing chips. |
| 2 | Match System / Real World | 4 | Solid — PHP, GCash, plan auto-fill, "due date cannot be in the past" speak the operator's language. |
| 3 | User Control and Freedom | 3 | Good exits everywhere, but a mis-recorded payment is unrecoverable for non-owner staff — the person who actually records payments. |
| 4 | Consistency and Standards | 3 | Payments tab still ships the run-on dot-separated meta line (815-820) excised from Invoices (597-603). One red voice is fixed; two tabs still speak differently. |
| 5 | Error Prevention | 4 | Solid — prefill + hard mismatch guard + aria-invalid + "Must equal" hint; best-in-class money guard. |
| 6 | Recognition Rather Than Recall | 4 | Solid — statuses as words, counts on chips, member/invoice search, amount prefilled. |
| 7 | Flexibility and Efficiency | 3 | Search + chips + paging help, but no keyboard fast path, no bulk, no jump-to-page, no sort; record payment is 3 clicks deep. |
| 8 | Aesthetic and Minimalist | 4 | Solid — vermillion correctly reserved; paper/green/red hierarchy calm and correct; no shadows, gradients, radius. |
| 9 | Error Recovery | 4 | Solid — Retry paths, role-failure degrade, focus restoration with chip fallback. |
| 10 | Help and Documentation | 3 | Instructive inline errors + honest empty states, but the full-amount-only payment rule is a silent wall until broken. |
| **Total** | | **36/40** | **Excellent** |

## Design Specificity Verdict

**Moderately specific — and the specificity lives in the data layer, not the surface.** PHP currency via Intl.NumberFormat('en-PH'), Philippine timezone bucketing, GCash as a first-class method, plan-driven auto-fill, derived overdue status, honest "Record-only — no payment processor" framing, and the "Collected by staff — today vs this month" ledger are unmistakably this product. What is interchangeable dark-admin: the summary trio, search+chip filter row, Prev/Next pagination, #A3A3A3-on-#0A0A0A restraint. Acceptable for Operate mode, but the surface doesn't perform the bold-typography identity the app claims.

**Deterministic scan:** Detector exit 0, 0 findings on PaymentsPage.tsx, buttonClasses.ts, RowMenu.tsx. 34 inline hex literals (6 unique colors): #A3A3A3 x15, #FAFAFA x7, #FF3D00 x6, #262626 x4, #1A1A1A x1, #22C55E x1. #DC2626 = 0 occurrences (confirmed removed). 0 focus-visible in the page file. 0 rounded/shadow/gradient. All 13 buttons have visible text; no unlabeled icon-only buttons. RowMenu.tsx:139 = #FF3D00; dangerButtonClass = vermillion ghost anatomy. Round-6 fixes verified landed.

**Visual overlays:** Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

The round-6 fixes landed cleanly and this is now a strong, honest Operate surface. Outstanding reads as money, not error; one red voice everywhere; the list-first issue form with search is a real improvement. The remaining work is finishing the pattern you started (payments tab meta, partial-payment policy, focus management) and making the number voice consistent.

## What's Working

1. **Money-error prevention is genuinely best-in-class.** Amount prefilled from the invoice total, submit hard-disabled on mismatch, failure state instructional (aria-invalid + aria-describedby + "Must equal ₱X") — not just red.
2. **Role-gated destruction with layered confirmation and bulletproof focus restoration.** Void is owner/role-gated, double-confirmed, focus restored to the statement link or active chip as fallback. Best keyboard hygiene in the app.
3. **Honest, self-consistent system status.** displayStatus() drives the summary, chip counts, and row badges from one source of truth — they cannot disagree.

## Priority Issues

### P2 — Payments tab kept the run-on meta line you just removed from Invoices
- **What:** Lines 815-820 build one dot-separated sentence: `GCash · REF-123 · INV-009 · Aug 21, 2026, 10:14 AM · taken by Ana`. Wraps into gray prose on mobile — the exact anti-pattern round 6 flagged and fixed at 597-603 but not here.
- **Why it matters:** The two tabs are the same surface; a user who learned to scan Invoices rows will mis-scan this one. Signals the fix was spot-treatment, not a pattern.
- **Fix:** Mirror the invoices anatomy: member name + (method · invoice number) on line one, datetime · taken-by on line two, mono amount right. Same rhythm, same tokens.
- **Suggested command:** layout / polish

### P2 — The full-payment-only rule is a silent wall
- **What:** The amount input disables submit unless it exactly equals the invoice total (728), but nothing states this policy until the user types a wrong value. A front desk taking a deposit hits a dead button with no explanation.
- **Why it matters:** Partial payments are a real gym scenario (deposits, holds, first-month splits). The product enforces a business rule it never states; a disabled button reads as a bug, not a policy.
- **Fix:** Add a one-line hint in the payment panel at open ("Payment must equal the invoice total.") or treat partials as a deliberate product decision. At minimum, state the rule at the point of entry, not the point of failure.
- **Suggested command:** clarify

### P3 — No focus management when toggling the issue-invoice form
- **What:** "New invoice" (505) unmounts the button and mounts a form card above the list (421) with focus dropped to document.body; Cancel (488) does the same. Content reflows.
- **Why it matters:** Keyboard/tab users lose their place twice per operation; the card shoves the list down out of view while open.
- **Fix:** On open, focus the Member select; on close, restore focus to "New invoice". Optionally mount the form inside the Invoices card so the list doesn't scroll away.
- **Suggested command:** harden / polish

### P3 — Two number voices and three row rhythms on one page
- **What:** Summary stats are Inter Tight semibold (391, 397, 403) while row amounts are font-mono (606, 822). Row padding drifts: py-2 staff (796), py-4 payments (811), py-5 invoices (577). 34 inline hex literals in the file.
- **Why it matters:** The page says "amounts are mono" twice but not three times; the eye can't build one mental rule for what a number looks like. Inline hex will drift from spec.
- **Fix:** Put summary figures in mono to match row amounts; normalize row padding; move palette into Tailwind theme tokens.
- **Suggested command:** typeset / layout

### P3 — No search or filter on the Payments tab
- **What:** Invoices gets search + 5 filter chips (539-562); Payments tab gets none — just paging over the raw list (807-827).
- **Why it matters:** Reconciliation ("who paid today?", "what did the card terminal take?") is scan-only. Method/staff/date filtering would make this a real cash-reconciliation surface.
- **Fix:** Add method filter and/or search by member/invoice number on the Payments tab; consistent composition.
- **Suggested command:** shape / layout

## Persona Red Flags

- **Alex (power user):** Payment entry is 3 clicks + confirm with no keyboard shortcut; no jump-to-page, page-size control, or export; search only filters what's already loaded. The most frequent act on the page is the slowest to start.
- **Sam (accessibility):** Focus dropped to document.body when toggling the issue form; Tabs lack roving tabindex/arrow-key support; global `button:active { transform: scale(0.95) }` in index.css:41-47 contradicts the design spec's translate-only press feedback and isn't tamed by prefers-reduced-motion.
- **Jordan (first-timer):** The partial-payment wall is the first real dead-end; "Statement" (615) is an unglossed navigation promise; the Record-only constraint is stated once and then silently enforced.

## Minor Observations

- Code hygiene: broken indentation at 219, 421, 429, 484-492, 610-666 — signals the form was retrofitted.
- `paying` disables all "Record payment" buttons app-wide while one runs, but void is gated only by voidPending — you can open the void modal while a payment panel is open. Edge case worth a guard.
- On a paid invoice, the meta shows three dates (issued/due/paid) — the longest line on the page.
- 5 filter chips wrap on narrow screens; "All" count duplicates the card description.
- The chip fallback focus (312-315) uses aria-label lookups — brittle to label edits.
- Summary figures already use the em-dash convention during loading/loadError. Good.
- The amount-mismatch hint at text-xs vermillion is small for a touch screen.

## Questions to Consider

1. If recording payment is the most frequent act on this page, why is it a per-row toggle instead of a global quick-entry that matches a search?
2. The hard block on partial payments — is that a product rule or a technical shortcut? If a rule, own it visibly; if a shortcut, you're blocking a real front-desk scenario every shift.
3. You've decided "money owed is not an error." But is a calm paper "Outstanding" actually serving the desk clerk who must chase those members? Is the vermillion "Overdue" count doing enough emotional work alone?
4. The summary trio is sans, the row amounts are mono. Which number language does Jym speak?
5. If the app's identity is "Bold Typography / poster energy," where is that on the most-revenue-visible page in the product?
