---
score: 23
max: 40
na: 
p0: 0
p1: 3
timestamp: 2026-08-17T08-20-38Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Impeccable Critique — PaymentsPage (first run)

## Design Health Score: 23/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Pending labels good; success/error pinned to page top, off-screen mid-list, unannounced |
| 2 | Match System / Real World | 3 | PHP, cash/GCash/card/bank, PH timezone, honest "record-only" framing |
| 3 | User Control and Freedom | 2 | No reset for issue form; no undo; void permanently blocking |
| 4 | Consistency and Standards | 2 | Chip inversion; native window.confirm instead of ConfirmModal |
| 5 | Error Prevention | 3 | Mismatch guard disables Confirm + inline "Must equal ₱X"; repo double-checks |
| 6 | Recognition Rather Than Recall | 3 | Filter chips with live counts; member dropdown is pure recall |
| 7 | Flexibility and Efficiency | 2 | Plan select autofills total/due; no member search; Prev/Next only |
| 8 | Aesthetic and Minimalist Design | 3 | Gallery fidelity; metadata sentences bury the amount |
| 9 | Error Recovery | 2 | No reversal path for wrongly recorded payment |
| 10 | Help and Documentation | 1 | "Reference" unexplained; no reversibility guidance |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

High fidelity (tokens, hairlines, 0px, text CTAs, word badges) with three breaks: chip selected-state inverts the binding token; the one destructive action (void) uses browser window.confirm while the mature ConfirmModal sits unused; vermillion density (per-row Record payment CTA + 2 summary stats + errors + chips) exceeds the One Voice Rule.

**Deterministic scan:** 0 findings (PaymentsPage, RowMenu, ConfirmModal — exit 0). No false positives.

## Priority Issues

**P1 — Void uses native window.confirm** (PaymentsPage.tsx:219), not ConfirmModal — browser chrome on a poster surface; no pending/error/Tab trap. Fix: ConfirmModal with danger + Voiding… + error.

**P1 — Status feedback is top-of-page, off-screen, unannounced** (:290-291) — failure while scrolled to row 12 is invisible; success is heading-colored white, silent to screen readers. Fix: inline errors near the form; role="alert"/aria-live; distinct success style.

**P1 — Chip selection violates the binding design system** (buttonClasses.ts:16-19 vs DESIGN.md chip-selected: Warm Paper fill, carbon text) — also inflates vermillion. Fix: invert to bg-[#FAFAFA] text-[#0A0A0A], px-4 py-2.

**P2 — Member select is an unscannable recall dropdown** (:330-344) — hundreds of members, no search. Fix: typeahead/datalist.

**P2 — Keyboard focus lost when RowMenu closes (no id passed); no visible focus-visible state on text-only buttons.** Fix: pass per-row id; add focus-visible outlines per DESIGN.md:198.

**P3 — No reversal path for a wrongly recorded payment** (paid rows hide all actions; repo forbids voiding paid). Fix: owner-only correction flow.

**P3 — One-item overflow menu for the only destructive action** — void costs 2 clicks + confirm, hidden from first-timers.

## Persona Red Flags

- Alex: no keyboard accelerator, no member search, summary + form push list below fold, no page jump.
- Jordan: "Reference" meaningless; void behind cryptic …-menu; native confirm breaks the language.
- Sam: focus to body after menu Escape; silent status changes; no focus rings; Record payment→Close toggle unannounced.
- Riley: wrong-invoice payment is un-undoable; void permanent; off-screen errors at failure.

## Minor Observations

- Outstanding counts due-date-less invoices forever; pagination no page numbers; "Unattributed" fallback reads as bug; no reset for abandoned draft; Confirm enables on empty amount then errors at top; row = Statement link + More menu + CTA (confusion risk); staff summary panel good.

## Provocative Questions

1. If a payment is recorded against the wrong invoice at 6 PM with the owner gone, what does the desk do?
2. Is a payment screen a single-action page (system's assumption) or a multi-action grid (reality) — should the system grant a row-primary-action exception?
3. Would an undo-window for void serve this desk better than the cheapest possible destroy path?
