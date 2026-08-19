---
target: Dashboard page
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
p2_count: 1
timestamp: 2026-08-19T16-22-17Z
slug: apps-web-src-features-dashboard-dashboardpage-tsx
---
# Critique — Dashboard (DashboardPage.tsx)

Method: dual-agent (A: ses_fe52ec67cffe8YCAhttH710W91 · B: ses_fe52ec4dcffemq9TVTLmL4jJLb)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Bare "Loading…" with no progress; outcome never reported — a failure silently swaps in fabricated data |
| 2 | Match System / Real World | 2 | "This week" = rolling 7 days incl. today; "This month" = calendar; "All time" = undefined |
| 3 | User Control and Freedom | 1 | Only the single CTA is interactive; no drill-down, refresh, or retry; hung request strands "Loading…" |
| 4 | Consistency and Standards | 2 | Chart paints positive attendance in the app's semantic "bad" red (#FF3D00) |
| 5 | Error Prevention | 1 | Mock fallback converts real failures into zeros — outage reads as "no activity" |
| 6 | Recognition Rather Than Recall | 3 | Glanceable labels/numbers, but chart has no axis; trend recognition needs manual math |
| 7 | Flexibility and Efficiency | 1 | No accelerators, no quick check-in, no act-on-the-data |
| 8 | Aesthetic and Minimalist Design | 3 | Disciplined tokens; near-empty Membership card masks thin content |
| 9 | Error Recovery | 0 | No error UI at all — only console.warn + fake data; recovery impossible because failure is invisible |
| 10 | Help and Documentation | 1 | No tooltips/inline definitions; no empty-state guidance |
| **Total** | | **15/40** | **Poor** |

## Design Specificity Verdict

- **LLM assessment:** Category-interchangeable with a gym-shaped skin. Strip the "Record a check-in" link and the domain words and this is a generic dark-mode SaaS analytics page: three stat cards, a weekly bar chart, one CTA. Nothing on it is only needed by a gym front desk — no "who's in the building," no recent check-ins to verify, no expiring/overdue members to chase at the door. The one operational element (the CTA) is the visually weakest thing on the page.
- **Deterministic scan:** 0 detector findings on DashboardPage.tsx (exit 0). The detector's silence on the chart is a gap, not a pass — see priority issue 2.
- **Visual overlays:** no browser available in this environment — skipped; fallback signal is the CLI scan above.

## Overall Impression

Visually disciplined and timezone/money-correct, but this is a Review page wearing a dashboard's clothes: an error path that fabricates data, an inaccessible color-only chart, and an information architecture aimed at an owner instead of the person at the door.

## What's Working

1. Timezone/currency rigor — attendance bucketed in Asia/Manila (`phDayStartUtc`/`phDateInDays`), money via `en-PH`/PHP.
2. Token discipline — consistent border/muted/accent usage, well-tracked uppercase labels, generous spacing.
3. One honest signal — the "Record a check-in" CTA correctly identifies the one high-frequency job (right instinct, wrong presentation priority).

## Priority Issues

- **[P0] Silent mock-data fallback on failure** (DashboardPage.tsx:35-40). Any Supabase error triggers console.warn + unseeded mock data = all zeros. Fake data presented as real is worse than an error — an outage becomes "nobody came today," and trust is unrecoverable. Fix: fall back to mock only when hasSupabaseConfig is false; render an explicit error state + Retry on real failure; badge mock data as "Demo data."
- **[P1] Bar chart is inaccessible and information-thin** (DashboardPage.tsx:65-78). Plain divs, color-only encoding (accent vs #1A1A1A), no role/aria-valuenow, no axis, no baseline, no tooltip, no "today in progress" marker. Fix: role="img" with per-column aria-label or a semantic list/table; axis labels + max-value caption; mark today's column "in progress."
- **[P1] Page doesn't serve the front-desk job.** All-time revenue and 7-day history are owner optics; the door worker needs who's here / who owes / who's about to expire. Fix: reorder — check-in action + today's operational list first, history below; make the CTA the visual primary.
- **[P1] Inconsistent/ambiguous time semantics.** "This week" (rolling) vs "This month" (calendar) vs "All time" (unbounded) vs "Outstanding" (undefined). Fix: consistent buckets, date-range subcaptions, define Outstanding inline.
- **[P2] Loading/empty states are a single gray line.** Repeated "Loading…" with layout shift on resolve; empty data = bare zeros. Fix: skeletons; distinct empty states; differentiate 0 from unavailable.

## Persona Red Flags

- **Alex (power user):** the tool the job needs (check-in) is behind three analytics cards, reachable only by scrolling then navigating away. No inline check-in, no recent-member recall, no shortcut. The one interactive-looking element (the chart) is dead — bars aren't clickable.
- **Sam (screen-reader):** the chart is a flat unlabeled sequence of counts/labels with decorative divs silently skipped — data and art are indistinguishable. Loading isn't aria-live, so Sam may never hear when data arrives; errors are swallowed, so Sam is never told numbers are fake. primaryButtonClass/ghostButtonClass carry no focus-visible ring class.

## Minor Observations

- Math.max(height, 4) forces a 4px sliver for zero-count days — a bare bar implies some activity.
- Bar scale capped at 100px inside a 160px container — the tallest bar never fills the frame.
- Today's bar reads low at 9am with no "in progress" annotation.
- Mock repo uses local time; Supabase uses Asia/Manila — day boundaries can disagree.
- "Beta" badge shows on every page incl. the landing page.
- React StrictMode double-fires load() in dev.
- "Attendance" (card) vs "Check-in" (CTA) — two names for one concept.

## Questions to Consider

1. If the DB is down, is "0 attendance" better than showing nothing? The code chose "yes."
2. Why lead with 7 days of history when the only door question is "who is this and are they paid?"
3. Should "Outstanding" be on the front-desk view at all, or is it owner-only info?
4. If the worker deleted the chart, would they act differently in the next 30 seconds?
5. Which single number is worth more: all-time revenue or who's in the building now?
