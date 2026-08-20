---
target: Payments page round 6
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-08-20T17-01-47Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
---
target: Payments page round 6
total_score: 30
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-08-21T00-00-00Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Critique Round 6 — Payments (v1.026)

- Target: apps/web/src/features/payments/PaymentsPage.tsx
- Score: 30/40 — Good
- Method: dual-agent (A: ses_fdfe55524ffeRZnouwG8E2whb7 · B: ses_fdfe52370ffeLgXrHUehVC1BXQ)
- Detector: exit 0, 0 findings (page + SectionCard/Tabs/StatusBadge/RowMenu/ConfirmModal/BackLink/PageShell/buttonClasses). Manual greps: 30 inline hex lines in page; RowMenu.tsx:139 danger = text-[#FF3D00]; 0 focus-visible; 0 radius/shadow/gradient.
- Browser visualization skipped (no browser automation available).

## Heuristic scores
1. Visibility of System Status 4
2. Match System / Real World 4
3. User Control and Freedom 3 — no search to escape long paged lists
4. Consistency and Standards 2 — Void vermillion in RowMenu vs #DC2626 in ConfirmModal
5. Error Prevention 4 — amount prefill + mismatch guard
6. Recognition Rather Than Recall 2 — run-on meta walls; no member/invoice search
7. Flexibility and Efficiency 2 — no search; paging 15; status-only filters
8. Aesthetic and Minimalist 3 — 8+ vermillion elements; Outstanding in error-red
9. Error Recovery 4 — role/load failure degrade gracefully; focus fallback
10. Help and Documentation 2 — full-amount-only rule and "Record-only" unglossed

## Priority issues
- P1: Outstanding rendered in #FF3D00 (error red) — money owed ≠ error; 8+ vermillion steady-state. Fix: Warm Paper for Outstanding, vermillion only for Overdue count.
- P1: Two reds for Void — RowMenu.tsx:139 #FF3D00 vs dangerButtonClass #DC2626 (buttonClasses.ts:13-14); #DC2626 off-palette, fails AA. Fix: delete #DC2626, reuse ghost anatomy vermillion.
- P2: Invoices tab fuses create-form (412-486) above list; Payments tab passive. Fix: collapse form behind "New invoice" button.
- P2: Run-on dot-separated meta lines (563-568, 771-776) wrap into prose on mobile. Fix: two-line row — member · plan / Mono money tuple.
- P2: No member/invoice search on highest-frequency action. Fix: client-side text filter over memberName/invoiceNumber.

## Minor observations
- Summary money in Inter Tight, not Mono token.
- handleCreateInvoice leaves Member selected after success.
- issued {datetime} vs due {date} precision mismatch.
- "Beta" tag is permanent chrome.
- Overdue count not cross-referenced to Overdue chip.
- Staff-summary box uses filled surface for read-only data.

## Persona red flags
- Alex: always-on form + no search throttle daily record-payment; red-alert fatigue from Outstanding.
- Jordan: two jobs on one screen; partial payment is a dead-end with no explanation of full-payment rule.
- Sam: #DC2626 fails AA; two reds for one action; run-on meta reads as one sentence; tabs lack roving tabindex/arrows.
- Casey: action cluster wraps; meta wraps into gray prose; 5 chips wrap.

## Strengths
1. Money-error prevention (prefill + hard mismatch guard) — best-in-class.
2. Role-gated destruction with layered confirmation + focus restore.
3. Honest system status (write-then-refresh separation, role-failure Retry).

## Score trend
23 → 21 → 28 → 30 → 34 → 30.
