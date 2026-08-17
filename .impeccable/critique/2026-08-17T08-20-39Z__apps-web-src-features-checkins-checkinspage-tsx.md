---
score: 21
max: 40
na: 
p0: 2
p1: 2
timestamp: 2026-08-17T08-20-39Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Impeccable Critique — CheckInsPage (first run)

## Design Health Score: 21/40 (Acceptable) — lowest of the three surfaces

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Per-button pending excellent; success = plain white text top-of-page, off-screen; delete silent |
| 2 | Match System / Real World | 2 | Raw manual/qr method labels; "QR code or member ID" conflates; grace copy genuinely human |
| 3 | User Control and Freedom | 2 | No undo; native confirm; history date guard silently no-ops |
| 4 | Consistency and Standards | 2 | Delete bypasses ConfirmModal; Tabs no roving focus; ad-hoc amber-border PIN panel; duplicated row JSX |
| 5 | Error Prevention | 2 | Repo duplicate guard solid; UI never pre-checks "already checked in today" before PIN |
| 6 | Recognition Rather Than Recall | 3 | "Recent" = newest-created not frequently-checked; rows carry no plan |
| 7 | Flexibility and Efficiency | 2 | Enter submits PIN; no autofocus on search; QR+PIN = 4-step gauntlet |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; vermillion saturation; seconds in timestamps clutter |
| 9 | Error Recovery | 2 | Clear messages; errors far from trigger; "Incorrect PIN." no counter |
| 10 | Help and Documentation | 1 | Nothing explains PIN setup, 3-day grace, CSV columns |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

Visually on-system, procedurally off-brand: native window.confirm on the destructive delete path; One Voice Rule breached with up to 7 vermillion CTAs on the default tab; grace-period warning rendered in "bad" red instead of Due Amber; amber-border PIN panel variant defined nowhere in the system.

**Deterministic scan:** 0 findings (CheckInsPage, QrScanner, RowMenu, ConfirmModal — exit 0). No false positives.

## Priority Issues

**P0 — Feedback is invisible to the person who needs it.** Success/error = plain <p> at page top (:281-282), far from the triggering row, never announced (no role="alert"/aria-live). After a successful check-in the row stays enabled with "Check in" — the only confirmation can be off-screen. Fix: feedback at the row or a fixed announce region + live regions + transient "Checked in ✓" row state.

**P0 — The PIN prompt appears away from the click that summoned it.** pinFor panel renders at the top of the card (:320-363) while the trigger is a row button deep in the search list; no scroll-into-view, no autofocus. Fix: render inline at the clicked row or scrollIntoView + focus the PIN input.

**P1 — Destructive delete bypasses the app's own ConfirmModal** (:244 window.confirm) and confirms nothing on completion. Fix: ConfirmModal danger + success message.

**P1 — The UI never shows "already checked in today" even though the data is loaded** (:54-59 fetched, never consulted). Clerk discovers duplicates only after PIN entry via top-of-page error. Fix: cross-reference checkIns in row rendering — disable + badge; short-circuit in beginCheckIn.

**P2 — One Voice Rule overload + quartet misuse.** Up to 7 vermillion primaries; grace warning in red should be amber. Fix: demote Scan QR to outline; keep per-row Check in as the single primary; amber for the grace notice.

**P2 — PIN input is visible text on a shared desk machine** (:328-342) — no type="password". The PIN belongs to the member, not the clerk.

## Persona Red Flags

- Alex: no autofocus/shortcut to search; QR+PIN = 4 steps; row stays armed after check-in (double-click risk).
- Jordan: will type a name into the QR field; PIN panel materializes away from the click.
- Sam: window.confirm inconsistent; QrScanner no Escape/trap/dialog role; Tabs ignores arrow keys; nothing announced.
- Riley: peak hour = scanner full-screen, PIN off-screen, errors top-of-page, no already-in pre-warning.

## Minor Observations

- Duplicated member-row JSX (drift risk); method labels should read "Desk"/"QR"; success message never auto-clears; timestamps with seconds; History "Load" + "Export CSV" both primaries; scanner has no scan frame/status; stale success persists across attempts.

## Provocative Questions

1. Did we design the PIN flow around the click — or around the convenience of a single state slot in the component tree?
2. Five vermillion "Check in" buttons is a structural One-Voice violation — is the rule wrong for row-driven operational surfaces, or is the surface wrong for the rule?
3. The app already holds today's check-ins in memory and refuses duplicates at the repo — why does the UI start a doomed flow and discover the truth only after the PIN prompt?
