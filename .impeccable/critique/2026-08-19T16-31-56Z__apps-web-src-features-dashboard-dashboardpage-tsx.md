---
target: Dashboard page
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
p2_count: 5
timestamp: 2026-08-19T16-31-56Z
slug: apps-web-src-features-dashboard-dashboardpage-tsx
---
# Critique — Dashboard (round 2, after v1.021 fixes)

Method: dual-agent (A: ses_fe523f5b0ffebPl50ZyiJds5sJ · B: ses_fe523e07bffeL4tSBQOvskkTpS)

## Design Health Score: 30/40 (up from 15/40)

| # | Heuristic | Score | Key note |
|---|-----------|-------|----------|
| 1 | Visibility of System Status | 3 | Honest loading/error/demo states + "so far" for a partial day; no "last updated"/refresh once loaded |
| 2 | Match System / Real World | 3 | Plain language, PHP currency; "This week" is rolling 7-day, not calendar week |
| 3 | User Control and Freedom | 3 | Real Retry on error; no refresh on success, no cancel on slow load |
| 4 | Consistency and Standards | 3 | Tokens used consistently; hero CTA is a bespoke class with a no-op hover |
| 5 | Error Prevention | 3 | maxDay + min bar height guard crashes; 4px zero bars can read as data |
| 6 | Recognition Rather Than Recall | 4 | Hero number + counts above bars + Peak caption — no mental math |
| 7 | Flexibility and Efficiency | 2 | Static snapshot on mount; stale mid-shift, no polling/shortcut |
| 8 | Aesthetic and Minimalist Design | 4 | Clean hierarchy, hero-led; minor dot+text redundancy |
| 9 | Error Recovery | 3 | Solid Retry card; transient failure nulls the whole view; raw Supabase wording may surface |
| 10 | Help and Documentation | 2 | Descriptions + Peak caption help; no help for "Outstanding"/"so far"/refresh |

## Verdict on the three fixed items

- P0 mock fallback: RESOLVED (error card + Retry; demo only without config, labeled).
- P1 chart a11y: RESOLVED (role=img + full aria-label with "so far", tooltips, peak caption, today dot).
- P1 front-desk reorder: RESOLVED (hero: today + Record a check-in as primary; history below).

## Priority issues (remaining / introduced)

- P1 Static data, no refresh — useEffect fires once; today's count goes stale if a colleague checks someone in while the tab stays open. Poll or add a refresh control.
- P2 False "Peak" on a fully zero week — maxDay = Math.max(1,...) + caption renders "Peak: 1 check-ins in a day"; guard on empty and pluralize.
- P2 "This week" label mismatches rolling-7-day filter; rename or compute calendar week.
- P2 Raw Supabase error surfaced to users (RLS/permission wording possible).
- P2 Mock vs live timezone divergence (local vs Asia/Manila day buckets).
- P2 (a11y) No h2s — only the PageShell h1; SR users can't jump to Revenue/Membership.
- P2 (a11y) No focus-visible affordance on hero CTA / Retry / ghost buttons; focus not moved to Retry on error; chart is browse-only (non-focusable).

## Persona red flags

- Alex: one click to check-in is good, but the hero count can go stale mid-shift with no refresh; the CTA is a full page nav.
- Sam: live regions + chart label are right; residual — "so far" only in aria/title/hero, no h2 structure, focus gaps.

## Minor observations

"Peak: 1 check-ins" grammar · hover no-op on hero button · loading first paint is a sparse card · Retry has no disabled state (double-click races) · mock attendanceWeek UTC-vs-local comparison off-PH.

## Detector (Assessment B)

exit 0, findings `[]` (no browser available in this environment — static source review stated).
