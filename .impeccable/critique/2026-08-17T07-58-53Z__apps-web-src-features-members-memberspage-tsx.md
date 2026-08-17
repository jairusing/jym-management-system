---
score: 26
max: 40
na: 
p0: 0
p1: 2
timestamp: 2026-08-17T07-58-53Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Impeccable Critique — MembersPage (round 4, post-P1/P2 fixes)

## Design Health Score: 26/40 (Acceptable) — trend 25 → 27 → 26 → 26

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending labels everywhere; add-success silent; QR race can show a stale image |
| 2 | Match System / Real World | 3 | Desk language right; "Activate/Deactivate" vs "Cancel membership" overlap |
| 3 | User Control and Freedom | 3 | Focus restore now works (stable trigger id); delete still drops focus to body |
| 4 | Consistency and Standards | 2 | Chip selected-state off-token; "Pauseing…" typo; same-row two-color status |
| 5 | Error Prevention | 3 | Consequence copy, Cancel-first danger modals, double-submit guards |
| 6 | Recognition Rather Than Recall | 2 | All row actions behind "More"; no visible PIN/login state on rows |
| 7 | Flexibility and Efficiency | 2 | 3-4 clicks per state change; Prev/Next-only pagination; no shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Discipline holds; dual vermillion per row; sentence-length modal titles |
| 9 | Error Recovery | 3 | Modal retry, load Retry, focus restore, inline panel errors |
| 10 | Help and Documentation | 2 | Best copy in the app (PIN rationale); no filter semantics help |
| **Total** | | **26/40** | **Acceptable** |

## Round-3 Punch List — Verification

| Fix | Verdict |
|---|---|
| Focus restore via stable DOM id (`member-menu-${id}` on the RowMenu trigger) | **WORKS** — trigger stays mounted; restore = getElementById().focus(). Only dead end: delete unmounts the row |
| Activate routed through confirm modal; addError scoped to Add form only | **VERIFIED** |
| Cancelled members show neutral gray "Cancelled" badge | **VERIFIED** |
| No membership renders neutral gray | **VERIFIED** |
| Add-member card back above the list; empty copy "Add your first member here." | **VERIFIED** |

**Deterministic scan:** 0 findings on all three targets (exit 0). No false positives.

## What's Working

1. Every blocking action is a context-rich confirmation with a safe default — deactivate names the plan + date + immediate block; danger modals auto-focus Cancel; safe ones auto-focus Confirm. The risk is metered per action.
2. Focus restore genuinely fixed — the round-3 dead code (capturing an unmounting menuitem) is gone.
3. Status honesty: cancelled/no-membership no longer masquerade as failures; empty state points at the first action.

## Priority Issues (new)

**P1 — QR race:** qrDataUrl is one shared string; open A's QR then B's, and A's late toDataURL resolution overwrites B's panel — wrong QR shown at the desk. Fix: per-member map state.

**P1 — RowMenu fails the menu pattern and can run off-screen:** role="menu" with no arrow-key/Home/End handling, focus never moves into the menu, no roving tabindex; 8 items ≈320px anchored top-full right-0 — bottom rows drop the menu past the viewport.

**P2 — "Pauseing…"/"Resumeing…":** pendingLabel string concat. **FIXED post-critique** (explicit pendingLabels map + new in-flight label test).

**P2 — Two status systems, two colors, one row:** green "Active" badge + bold vermillion "Expired" line on one row; paused is amber badge but gray line. Fix: one status voice per row.

**P2 — Add-member success is invisible:** form clears, list reloads below the fold; no success line/scroll/flash. Pattern: loginMessage.

**P3 — Errors aren't announced; search has no accessible name:** plain <p> errors (only modal has role="alert"); search input placeholder-only.

## Persona Red Flags

- **Alex:** pause = 4 clicks; no arrow-key acceleration; no page numbers/jump; no bulk operations.
- **Sam:** menu role promises a keyboard pattern it doesn't implement; search has no name; delete dumps focus to body; modal Tab trap is correct.
- **Riley:** rapid QR surgery can show A's code in B's panel (fraud/brand event); last-row menu renders below viewport; safePage clamping holds.

## Minor Observations

- Chip selected state off-token (buttonClasses.ts vs DESIGN.md chip-selected)
- Modal titles are 25-word sentences with empty bodies; aria-describedby points at an empty paragraph
- Raw UUID "Member ID:" leaks into the whisper-metadata system
- scrollIntoView fires before the QR image lands, so the scroll target drifts
- whitespace-nowrap action cluster squeezes the name column on narrow widths
- 'expired' filter excludes no-membership (defensible, undocumented)

## Provocative Questions

1. Is the row a member or a menu directory with a name attached — what would QR/PIN/Pause look like surfaced directly?
2. "Active" speaks in three voices; a desk worker asks one question: can this person check in today? Should one gate subsume all three?
3. In Operate mode with a member standing there, is the modal the right mechanism — would a reversible "Undo" window beat the third click?
