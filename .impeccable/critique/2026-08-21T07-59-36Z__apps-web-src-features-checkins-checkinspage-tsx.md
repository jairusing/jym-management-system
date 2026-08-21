---
target: Check-ins page (round 15 re-critique after v1.031)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
p2_count: 3
p3_count: 1
timestamp: 2026-08-21T07-59-36Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Check-ins Page — Critique Round 15 (v1.031)

Method: dual-agent (A: ses_fdcb0bb0cffe745ReNAVR27Wn5 · B: ses_fdcb44570ffe5Q1ITyoaJNs5tT)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Busy states thorough; success renders at card top while action happens mid-list; Enter focus-jump unannounced |
| 2 | Match system / real world | 3 | Grace copy operator-perfect; but badge says "Expiring" for a membership already expired, contradicting its own sentence |
| 3 | User control & freedom | 3 | Cancels everywhere; stale PIN digits survive "Incorrect PIN."; success/error persist across tabs |
| 4 | Consistency & standards | 3 | LoadError+Retry now uniform across all three tabs (v1.031 parity landed); amber means warning AND panel chrome; History has two same-weight primaries |
| 5 | Error prevention | 3 | Layered gates re-validated; invalid date range makes Load a silent no-op |
| 6 | Recognition over recall | 3 | Live filtering + inline badges; the Enter hint only renders when query is empty — vanishes when the behavior applies |
| 7 | Flexibility & efficiency | 2 | Flagship Enter accelerator now works end-to-end; no autofocus, no Tabs arrow-roving, no date presets |
| 8 | Aesthetic & minimalist | 3 | Palette/type discipline intact; two near-identical row blocks invite drift; dead grid scaffold |
| 9 | Diagnose & recover | 2 | Loads fail into amber Retry panels cleanly; but write paths surface raw e.message at four sites; last-row delete drops focus to body |
| 10 | Help & documentation | 3 | PIN policy taught inline; CSV contents/grace rule source undocumented |
| **Total** | | **28/40** | **Acceptable, plateauing** |

Score-context note: third consecutive fresh-eyes scorer (32 → 29 → 28) while every flagged P1 across those rounds was fixed and detector-verified. The remaining findings are real but progressively smaller; part of the delta is per-scorer harshness variance (this scorer self-describes H9 as deliberately harsher).

## v1.031 Fix Verification

All three fixes verified landed by both assessments:
- Actionable-match logic present (handleEntrySubmit skips checked-in/inactive/blocked; inline explanation when nobody actionable).
- Delete focus preservation present (neighbor computation + setTimeout refocus to `checkin-menu-<id>`).
- History parity present (`historyLoadError` state, amber LoadError + Retry in History branch, console.warn demotion).

Reviewer praise: "Enter-to-select now honors its own promise"; "keyboard craft in the delete flow — rare care at this level"; membershipExpiry copy called decision-ready operational writing.

Deterministic scan: detector exit 0 on all three files; 39 hex occurrences across 7 tokens all on-palette; #DC2626 absent; zero rounded/shadow/gradient; zero unlabeled icon-only buttons; ring utilities intact on all four button classes; grace amber in both row blocks.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Priority Issues

### P1 — Write-path errors still speak fluent PostgreSQL
- What: beginCheckIn catch (:269), completeCheckIn catch (:285), handleSubmitPin catch (:313), handleConfirmDelete catch (:363) pass e.message straight to the UI. Load paths were demoted in v1.031; writes were not.
- Why: The desk will read "new row violates row-level security policy" at the exact moment trust matters most.
- Fix: Map repo errors to human copy ("Couldn't record the check-in. Try again."), log raw error to console.
- Command: harden

### P2 — Touch targets violate the binding spec on the busiest screen
- What: Button classes py-2 px-1 ≈ 36px; RowMenu trigger ≈ 36px. UI_DESIGN.md mandates 44x44 minimum.
- Why: Front-desk tablets are first-class; smallest target guards deletion.
- Fix: Expand hit areas without changing visual size.
- Command: polish

### P2 — Invalid date range silently no-ops Load
- What: loadHistory returns early when From > To with zero feedback.
- Why: Silent prevention reads as breakage.
- Fix: Inline validation message near the date fields.
- Command: polish

### P2 — Duplicate member-row JSX + the "Expiring" lie inside it
- What: Two ~55-line near-identical blocks with visible formatting drift; grace members labeled "Expiring" while the adjacent sentence says "Membership expired...".
- Why: Drift will eventually make lists behave differently; contradictory badge forces a fact dispute mid-transaction.
- Fix: Extract MemberRow component; rename grace badge "Grace" or "Expired (grace)".
- Command: shape

### P3 — Attention/feedback cluster
- What: Success at card top vs mid-list action; no autofocus on mount; PIN digits persist after failure; deleting the LAST remaining row leaves neighbor null → focus to body; Enter focus-jump unannounced.
- Fix: Row-proximate feedback or focus move; autofocus search on mount; clear/select PIN on failure; focus card heading when neighbor null; live-region announcement.
- Command: shape

## Persona Red Flags

- Alex: 36px targets, no autofocus, success fires a viewport away; double-check-in attempts predictable.
- Sam: 200-row flat dump no totals; silent range no-op looks like broken Load; raw write errors are screenshot bait.
- Jordan: Enter finally works but jump unannounced; last-row delete ejects to body; Tabs ignore arrows.
- Riley: deleted-row focus handoff fails on last row; stacked same-tone badges read as SR noise.

## Minor Observations

verifyMemberPin('') probe costs a round-trip per manual check-in; mount effect re-fetches everything when history dates change; type="search" native glyph cracks sharp edges; "most recent members" claim unverified against sort order; RowMenu trigger lacks focus-visible ring; shared success/error crosses tabs; GRACE_DAYS/membershipExpiry recreated every render; dead sm:grid-cols-3 scaffold; up to three badges can stack on one name line.

## Questions to Consider

1. Why does identity verification wear the same amber costume as an expired membership?
2. Why does the Enter instruction vanish at the precise moment the shortcut becomes relevant?
3. What is a front-desk worker supposed to do with "duplicate key value violates unique constraint"?
4. The badge says EXPIRING; the sentence says expired. Which one do you want the desk to believe?
5. Is History a report or a database dump wearing a poster's clothes?
