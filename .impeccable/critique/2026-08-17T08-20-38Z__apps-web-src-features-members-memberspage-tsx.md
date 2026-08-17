---
score: 28
max: 40
na: 
p0: 0
p1: 3
timestamp: 2026-08-17T08-20-38Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Impeccable Critique — MembersPage (round 5, post round-5 P1 fixes)

## Design Health Score: 28/40 (Acceptable) — trend 25 → 27 → 26 → 26 → 28

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending maps excellent; every destructive success ends silent |
| 2 | Match System / Real World | 3 | Desk-native vocabulary; "Deactivate" vs "Cancel membership" near-synonyms |
| 3 | User Control and Freedom | 2 | QR panel has no close affordance; menu item selection drops focus to body; no undo |
| 4 | Consistency and Standards | 2 | Chip-selected off-token; QR panel lacks the Cancel its siblings have |
| 5 | Error Prevention | 3 | Confirm modal on every state change; danger styling; consequence copy |
| 6 | Recognition Rather Than Recall | 3 | Rows self-describing; menu contents depend on invisible state |
| 7 | Flexibility and Efficiency | 3 | PIN autoFocus + Enter fastest path; arrow-key menu; no search shortcut/sort |
| 8 | Aesthetic and Minimalist Design | 3 | Typography sings; vermillion density over One Voice budget; two competing primaries |
| 9 | Error Recovery | 3 | Modal retry, load Retry; QR error has no retry; hung promise inescapable |
| 10 | Help and Documentation | 3 | Genuinely good embedded help (PIN rationale); no tooltips on verbs |
| **Total** | | **28/40** | **Acceptable** |

## Round-5 Punch List — Verification

| Fix | Verdict |
|---|---|
| QR race — per-member keyed qrDataUrls map | **VERIFIED** — stale resolution structurally cannot overwrite a newer panel |
| RowMenu keyboard — arrows/Home/End, focus-in, Escape restore, 70vh cap | **VERIFIED** — a real ARIA menu now |
| Pausing…/Resuming…/Cancelling… explicit map | **VERIFIED** |

**Deterministic scan:** 0 findings on all three targets (exit 0). No false positives.

## What's Working

1. QR race fix is clean — keyed writes + typed sentinel, keyed cleanup.
2. High-stakes copy does the emotional work: deactivate names plan + expiry, cancel names irreversibility and the fresh-start path, delete enumerates the blast radius.
3. RowMenu is now a genuine ARIA menu (label, arrows, focus-in, escape restore, scroll cap).

## Priority Issues

**P1 — Menu→panel handoff breaks keyboard control; QR panel is undismissable-by-discovery.** Item clicks close the menu without restoring trigger focus (RowMenu.tsx:133-136); the QR panel has no Cancel/Close while its three siblings do. Fix: restore trigger focus in item onClick; add a Close ghost button to the QR panel.

**P1 — Destructive actions end in silence; Delete ends in a focus void.** Success closes the modal with no success signal; delete unmounts the row so restoreConfirmFocus finds nothing → focus drops to body. Fix: fallback focus (search input/section title) + transient success announcement (role="status").

**P1 — The permanently open Add form is a second primary action above the list.** Full 5-field form + management list as equal cards; two vermillion CTAs in one viewport; the desk's constant act (find → QR/PIN) is pushed below the fold. Fix: collapse Add into a text trigger that expands the form.

**P2 — chipClass violates the binding chip-selected token** (vermillion border/text vs Warm Paper fill + carbon text per DESIGN.md); inflates vermillion density.

**P2 — One row, two statuses, two truths:** red "Inactive" badge beside gray "Gold until…" line for deactivated-with-membership members.

## Persona Red Flags

- Alex: every check-in = 2 clicks through an 8-item menu + QR regenerated every open; no search shortcut/sort/page-jump.
- Jordan: Show QR opens a panel with no visible exit; Deactivate vs Cancel membership indistinguishable; menu contents unpredictable.
- Sam: menu selection drops focus to body; search placeholder-only; form errors unannounced; delete = focus void.
- Riley: hung network = inescapable modal (no timeout); QR re-render shifts layout mid-list.

## Minor Observations

- RowMenu items text-xs vs spec text-sm; filter chips lack paren counts; search misses plan names; new member may land on page 2+ (no reset); Member ID not in spec mono; add form accepts junk email/phone; duplicate member-panel ids (mutual exclusion only); menu z-30 under sticky header z-40; raw Supabase error strings in copy; no clear-filters affordance; load error replaces the whole toolbar.

## Provocative Questions

1. Why is the desk's highest-frequency act (pull up QR/PIN) two clicks deep inside an 8-item overflow, on rows below a permanently open 5-field form?
2. When vermillion becomes the default (eyebrow, Beta, CTA, chips, expired, inactive, danger), what remains to be loud about?
3. In a queue where members watch the screen, is silent success a confident ending — and what's the cheapest trustworthy "done" without toasts?
