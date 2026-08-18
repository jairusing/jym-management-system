---
target: Payments page re-run
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-18T08-18-14Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Payments Page — Critique Round 2

Method: dual-agent (A: ses_fec118185ffeb8aAYJta5vcydc · B: ses_fec1176ecffe0rLOWazHNAvfA5)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Success is dead code — setSuccess is never given a value; errors render top-of-page, off-screen, unannounced |
| 2 | Match System / Real World | 3 | Domain-true language; minor "due date" conceptual drift |
| 3 | User Control and Freedom | 1 | Void runs on window.confirm with focus pre-armed on OK (Enter = void); menu-close focus drops to body |
| 4 | Consistency and Standards | 3 | Status quartet exact; chips off-token; Tabs underline vs chip spec |
| 5 | Error Prevention | 3 | Amount-mismatch guard is excellent; void is the weak link |
| 6 | Recognition Rather Than Recall | 2 | Member select resets to blank every invoice; icon-menu forces recall |
| 7 | Flexibility and Efficiency | 2 | Plan prefill is a fast path; payment panel isn't a form (Enter dead); Prev/Next only |
| 8 | Aesthetic and Minimalist Design | 2 | Up to 15 vermillion row CTAs + form CTA + Outstanding figure — One Voice Rule broken at row scale |
| 9 | Error Recovery | 2 | Errors away from action; Supabase failure silently swaps in mock money |
| 10 | Help and Documentation | 2 | Empty states excellent; nothing explains the amount-equality rule |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Authored — status quartet mapped exactly (paid->green, issued->amber, overdue->red, void->gray), plan-prefill/auto-renewal is gym-specific behavior, action-oriented empty states. Three leaks betray the voice: browser-chrome window.confirm for voiding, top-of-page feedback (contradicting the v1.015 "feedback at the action" migration), and off-token chips. Unfinished rooms in an authored building.

**Deterministic scan:** 0 findings across all 7 files, exit 0, verified functional (help probe + non-JSON rerun). No novel catches. Browser visualization skipped — no browser tool in this environment.

## Overall Impression

The page has the best micro-interaction in the app (the amount-mismatch guard) and the worst one (void via window.confirm, Enter-to-destroy). The biggest discovery: this page literally cannot tell the desk "payment recorded" — setSuccess is unreachable code. And in Supabase mode, a backend failure renders fabricated money with zero indication. 21/40 (23 in round 1 — the drop is honest: this run found the dead success path and the lying fallback).

## What's Working

1. **Exact Status Quartet mapping** — including derived overdue display status (PaymentsPage.tsx:427)
2. **Amount-mismatch guard** — confirm disabled + vermillion inline hint, the desk's most likely money error, prevented
3. **Plan-prefill + auto-renewal** — one select does total, due date, and membership extension
4. **Action-oriented empty states** — "No invoices yet. Issue your first invoice above."

## Priority Issues

**P0 — Void via window.confirm** (PaymentsPage.tsx:219). Browser chrome breaks the poster identity; focus defaults to OK — one Enter after opening = invoice destroyed; no pending state, no in-dialog error. The app's own ConfirmModal danger variant autofocuses Cancel and already handles pending/error/focus-restore — the instrument exists and wasn't used. Fix: migrate to ConfirmModal ("Void invoice…" / "Voiding…"), migrate the 2 tests that spy on window.confirm. -> /impeccable polish

**P1 — Feedback is off-screen, unannounced, and success is impossible** (PaymentsPage.tsx:290). No live regions; setSuccess never assigned. Record a payment -> no confirmation anywhere. Fix: success/error in the card in use (issue card, payment panel, modal result) with role=status/role=alert, per the v1.015 pattern. -> /impeccable clarify

**P1 — Silent mock-data fallback in Supabase mode** (PaymentsPage.tsx:124). After any load error, totals, staff summaries, and lists render fabricated data with zero indication — the desk can "operate" against fake money. Fix: persistent alert + empty/disabled table; never silently fake money. -> /impeccable harden

**P1 — RowMenu focus restore is dead on this page** (PaymentsPage.tsx:468). RowMenu only restores trigger focus when id is passed; PaymentsPage passes none — so Escape/outside-click drop focus to body, contradicting the v1.013 changelog claim for this page. Fix: id={`invoice-menu-${invoice.id}`}. -> /impeccable audit

**P2 — Selected chip off-token** (buttonClasses.ts:16). Spec: selected inverts to Warm Paper fill + carbon text; implementation uses vermillion border/text, and the base chip misses the slate background / px-4 py-2 / 0.2em tracking. Fix: border-[#FAFAFA] bg-[#FAFAFA] text-[#0A0A0A]. -> /impeccable polish

**P2 — One Voice Rule at row scale** (PaymentsPage.tsx:455). Every unpaid row renders a vermillion "Record payment"; 15 rows = 15 loud CTAs + form CTA + Outstanding figure. Fix: demote row actions to ghost; only the active row speaks vermillion. -> /impeccable quieter

## Persona Red Flags

- **Alex (power user):** member select resets to blank every invoice; Prev/Next-only pagination; the payment panel isn't a form so Enter fails after typing a reference.
- **Sam (screen reader/keyboard):** void lands in browser-chrome window.confirm; feedback <p>s have no live regions (results silently missed); RowMenu Escape drops focus to body.
- **Casey (distracted):** payment result feedback sits at the top of a page she's scrolled into, often absent entirely; void's Enter-to-OK default means half-attention is one keystroke from destroying an invoice.
- **Riley (stress tester):** a Supabase outage shows mock money as real — exactly when the desk needs the truth.

## Minor Observations

- Summary renders "₱0.00 Outstanding" during load — a desk could act on it before data arrives
- "Record payment" resets method to cash on every open (repeat-GCash desks re-pick every time)
- No autofocus into the payment panel's Amount field
- Tests encode window.confirm (2 places) — the P0 fix must migrate them
- dangerButtonClass has no underline, unlike the ghost/primary family

## Questions to Consider

1. With 15 competing vermillion row CTAs, which action IS the desk's dominant one — and should the page's loudest element be the form or the list?
2. The page cannot say "payment recorded" — is that an omission, or an unspoken admission that the row turning green is meant to be enough?
3. If nothing is actually charged, does voiding need a confirmation ceremony at all, or an audited log entry with a lighter interaction?
