---
target: Dashboard page
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 6
timestamp: 2026-08-19T17-09-40Z
slug: apps-web-src-features-dashboard-dashboardpage-tsx
---
# Critique - Dashboard (round 4, after v1.023)

Method: dual-agent (A: ses_fe5034e90ffeoTrob1kxLdoJL1 / B: ses_fe503451effevNZmRKcLEzTPNa)

## Design Health Score: 26/40 (15 -> 30 -> 28 -> 26)

A scored 26/40. The drop vs round 2 reflects reviewer strictness on
token hygiene (hard-coded hex is repo-wide) and a dead-code focus bug in
dangerButtonClass, plus P2 a11y polish. B: detector exit 0, findings [],
browser unavailable (static review stated).

## Round-4 item verdicts
1 Refresh keeps data + live disabled guard: RESOLVED
2 Failed refresh keeps last-good view + banner: RESOLVED
3 Focus restore to hero on success: RESOLVED (leaked into failure path - fixed in v1.024)
4 Refresh hidden in demo: RESOLVED
5 "Dashboard unavailable" heading: RESOLVED
6 Chart focus-visible: RESOLVED; dangerButtonClass focus underline was
  dead code (no after base) - fixed in v1.024
7 useCallback/viewRef: RESOLVED (dual source of truth noted)

## Priority issues (at assessment time)
- P1 dangerButtonClass dead focus underline (fixed v1.024)
- P1 hard-coded hex literals (deliberately deferred - repo-wide convention)
- P2 banner Retry focus (fixed v1.024)
- P2 focus yank on failed retry (fixed v1.024)
- P2 no aria-live on refresh completion (fixed v1.024)
- P2 Refresh label width jitter (fixed v1.024)
- P2 chart monolithic aria-label (kept - counts are on-screen text)
- P2 raw Supabase error strings (kept - muted technical text, friendly lead)

## Verdict
Loop is plateauing in the 26-30 band; remaining findings are P2 polish
and repo-wide token hygiene. v1.024 shipped the polish items.
