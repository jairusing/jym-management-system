---
target: Dashboard page (round 5 re-critique after v1.034)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 2
p3_count: 1
timestamp: 2026-08-21T10-15-58Z
slug: apps-web-src-features-dashboard-dashboardpage-tsx
---
# Dashboard Page — Critique Round 5 (v1.034)

Method: dual-agent (A: ses_fdc33bb53ffecuVR0OzYcLZ2dE · B: ses_fdc3a892affeyY4e4oPCJVdER5)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Excellent state labeling; loading placeholder morphs into four sections |
| 2 | Match system & real world | 4 | Gym-native language, PHP/en-PH, "so far" qualifier |
| 3 | User control & freedom | 4 | Retry both paths, manual Refresh, nothing destructive |
| 4 | Consistency & standards | 3 | Amber frame + red text mixes two status voices; Attendance card breaks sibling drill-down pattern |
| 5 | Error prevention | 3 | Refresh disabled while loading; read-only surface |
| 6 | Recognition over recall | 3 | All data inline, but no deltas — owner must recall if 42 is good |
| 7 | Flexibility & efficiency | 2 | No shortcuts, no auto-refresh; adequate not efficient |
| 8 | Aesthetic & minimalist | 3 | Poster-clean, but chart's near-invisible ink is decoration masquerading as data |
| 9 | Recognize/recover from errors | 3 | Human copy + focus-to-Retry undercut by mixed color voice and footnote-scale headline |
| 10 | Help & documentation | 2 | Zero-context bare numbers; all-zero first-run indistinguishable from breakage |
| **Total** | | **30/40** | **Good** |

Up from 20 — the rise is earned; all five v1.034 fixes verified landed cleanly by both assessments.

## Design Specificity Verdict

SPECIFIC — the page speaks fluent Bold Typography with one blind spot. Every hex traces to the binding palette; poster-numeral hero, wide-tracked micro-labels, text-only vermillion CTA are unmistakably this system. The P0 fix killed style divergence at the root (primaryButtonClass single-sourced). Blind spot: UI_DESIGN.md defines no data-viz tokens, and the page filled that silence with #262626 bars on #0F0F0F — spec-compliant colors producing an illegible chart.

Deterministic scan: detector exit 0 both files; 25 hex occurrences across 7 values ALL on-palette (#737373 = 0 confirmed); rounded/shadow/gradient = 0; 0 unlabeled icon-only buttons; all 13 v1.034 checks verified line-by-line including exact bar-ternary match.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## What's Working

1. Stale-data honesty (125-141): distinguishing first-load failure from refresh-failure-with-timestamp is trust-preserving design most dashboards never attempt.
2. Root-cause token hygiene: deleted heroButtonClass means CTA styling can never drift again; console.warn keeps diagnostics while UI shows human copy.
3. Accessible chart alternative: role="img" full-data sentence with "so far" nuance, printed counts, careful retry/restore focus management.

## Priority Issues

### P1 — The chart's data ink is invisible
- What: History bars bg-[#262626] on card bg-[#0F0F0F] ≈ 1.26:1 contrast; zero-vs-busy distinction ≈ 1.15:1 — imperceptible. Border same color as fill.
- Why: The 7-day trend is the page's only time-series and only answer to "is today normal?" The sole legible pixel is today's orange bar; the shape of the week is carried entirely by tiny gray numerals. NOTE: this is a regression introduced BY the v1.034 accent fix (bars went vermillion → #262626).
- Fix: Nonzero history fill → an on-palette legible tone (#A3A3A3 muted gray ≈ 4.6:1); keep today #FF3D00, zero #1A1A1A. Consider documenting chart tokens in UI_DESIGN.md.
- Command: layout

### P1 — Fold economics break the page's stated job
- What: Header + hero + Attendance card push Revenue and Membership below the fold on standard laptops.
- Why: Page promises "Attendance, revenue, and membership at a glance" and delivers one-third above the fold; month-to-date revenue is the pulse.
- Fix: Compress Attendance card (h-32; drop the "Last 7 days" Stat that sums the visible bars) and/or compact stat strip beneath hero.
- Command: layout

### P2 — Error states speak in two voices, at whisper volume
- What: Amber frames ("warning") wrap red text ("blocked/bad") — one meaning per color violated inside a single component. Full-page failure headline "Dashboard unavailable" set at 0.7rem — smallest type on the page.
- Why: Is this a caution or an alarm? Hierarchy inversion in a strict-hierarchy system.
- Fix: Pick one voice; scale unavailable headline to text-2xl+.
- Command: polish

### P2 — Sibling cards break anatomical pattern
- What: Revenue and Membership have drill-downs; Attendance — sitting on top of /app/checkins — has none.
- Fix: Add "View check-ins" ghost link to /app/checkins.
- Command: layout

### P3 — Dead error copy invites drift
- What: setRefreshError stores a string never rendered — panel hardcodes its own copy. Two sources of truth.
- Fix: Render {refreshError} or store only the timestamp.
- Command: clarify

## Persona Red Flags

- Alex: revenue below fold + zero trend deltas — cannot answer "up or down vs usual?" without leaving.
- Sam: "Record a check-in" ~40px tall — under the 44px touch minimum — and text-only for the product's most-repeated action.
- Jordan: no auto-refresh; polling a gym-floor tablet means manual Refresh clicks all day.
- Riley: day-one all-zeros indistinguishable from breakage; demo banner quiet gray and absent in live-but-empty installs.

## Minor Observations

title attrs duplicate printed counts; role="img" tabIndex={0} creates a do-nothing tab stop; post-refresh focus lands on silent h2 while aria-live paragraph announces; lone Stat in multi-slot scaffold; timezone seam CONFIRMED in code (mock buckets browser-local, prod buckets Manila); loading placeholder morph still present.

## Questions to Consider

1. If the only legible pixel in the chart is today's orange bar, is the chart earning its 160 pixels?
2. Does the owner ask "how many?" or "how compared to usual?" at 7am — why does the page only answer the weaker question?
3. When the page fails, should it feel cautioned or alarmed? Amber-frame-red-text picks neither.
4. What does this dashboard look like on day one, all zeros — invitation or crime scene?
