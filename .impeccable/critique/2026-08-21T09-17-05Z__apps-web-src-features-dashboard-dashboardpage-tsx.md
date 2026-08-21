---
target: Dashboard page (round 4 critique after v1.033)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
p2_count: 1
timestamp: 2026-08-21T09-17-05Z
slug: apps-web-src-features-dashboard-dashboardpage-tsx
---
# Dashboard Page — Critique Round 4 (v1.033)

Method: dual-agent (A: ses_fdc68af80ffe9QE53E8kxwFL3x · B: ses_fdc6cd041ffe0W01U2IARHxmxU)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | "Updated" live region good; loading placeholder morphs into four sections — layout jump |
| 2 | Match system & real world | 3 | Operator language right; "Outstanding" is accounting shorthand |
| 3 | User control & freedom | 2 | Refresh/Retry focus choreography thoughtful — but every metric is a dead end |
| 4 | Consistency & standards | **1** | Error panels skip amber LoadError pattern; raw e.message rendered; primary CTA lacks mandatory focus ring |
| 5 | Error prevention | 3 | Buttons disabled during in-flight loads; little else can go wrong on read-only page |
| 6 | Recognition over recall | 2 | Zero trend context: is 12 check-ins good? No deltas or baselines |
| 7 | Flexibility & efficiency | 1 | Exactly one shortcut on the owner's landing page |
| 8 | Aesthetic & minimalist | 2 | Membership said three ways; tooltips duplicate printed counts; all 7 chart bars in accent |
| 9 | Recognize/diagnose/recover | 2 | Right structure undermined by raw Supabase strings and missing amber cue |
| 10 | Help & documentation | 1 | Zero affordances: no explanation of Outstanding, no empty-state guidance, demo disclosure a whisper |
| **Total** | | **20/40** | **Acceptable (low)** |

## Design Specificity Verdict

**Compliant skin, borrowed bones.** Token discipline real (every hex matches spec, zero radius, vermillion CTA) but composition is template admin dashboard wearing the Bold Typography costume: no massive numerals (hero is text-4xl in a system reaching 9xl/160px), no asymmetric grids, no typographic layering. Four identical stacked cards = SaaS boilerplate. It answers "how many came today" in 5 seconds; it does not answer "how is the gym doing" — nothing is compared, ranked, or routed.

Deterministic scan: detector exit 0 on both files; 30 hex occurrences across 7 values — INCLUDING #737373 x2 (lines 134, 161) which is OFF-PALETTE (not in UI_DESIGN.md tokens); rounded-full x1 (decorative aria-hidden dot); 0 shadows/gradients; 0 unlabeled icon-only buttons; buttonClasses rings intact; local heroButtonClass duplicates primaryButtonClass shape but omits ring/disabled utilities.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

Strong accessibility choreography and honest micro-copy; undermined by three self-inflicted violations of the app's own binding standards (focus ring, raw errors, amber pattern) and a composition that reports state without enabling decisions. The page every user sees first and most often missed the error-handling memo every other page learned.

## What's Working

1. Focus choreography best-in-codebase: Retry auto-focus on error, focus restored to hero heading after reload (guarded by restoreFocusRef), aria-live timestamp.
2. The chart's accessible alternative is genuinely designed: chartLabel composes a spoken sentence of actual data including "so far" disambiguation synced to phDateToday().
3. Honest micro-copy: "check-ins so far", conditional "so far" suffix, "Peak: N check-ins in a day" takeaway sentence.

## Priority Issues

### P0 — Primary CTA has no focus ring
- What: heroButtonClass (23-24) reimplements primaryButtonClass at text-base but omits every focus-visible:ring-* utility. Keyboard focus on "Record a check-in" shows only a 1px underline widening.
- Why: Violates binding standard and WCAG 2.4.7; Sam cannot see focus on the main action.
- Fix: Replace heroButtonClass usage with primaryButtonClass + text-base override; delete the local class.
- Command: polish

### P0 — Raw e.message surfaced to users
- What: Catch stores e.message (65); rendered verbatim at 134 (refreshError) and 161 (error).
- Why: Owners will read JWT expired / PostgREST strings during their busiest hour; violates established standard.
- Fix: Static human copy ("Check your connection and try again."); keep console.warn for detail.
- Command: harden

### P1 — Error panels ignore the LoadError pattern
- What: Both error surfaces (130, 154) use border-[#262626] bg-[#0F0F0F]; established pattern is border-[#FFB300] bg-[#1A1A1A] with role="alert" + ghost Retry.
- Why: Cross-page consistency teaches severity at a glance; failed dashboard looks like page furniture.
- Fix: Adopt amber panel anatomy for both blocks.
- Command: polish

### P1 — Every metric is a dead end; no quick links
- What: Only one route exists (204). "Outstanding ₱X" — the most actionable number — is inert text.
- Why: Owner's workflow after seeing Outstanding is "open Payments and chase it"; sidebar traversal breaks the 5-second promise at peak motivation.
- Fix: Ghost-button links: Outstanding → /app/payments, Active members → /app/members.
- Command: shape

### P2 — Hierarchy and accent economy betray the spec
- What: Hero number text-4xl (183) in a Type-as-Hero system; all seven chart bars full #FF3D00 (238); today marked only by a 4x4px dot (245-248).
- Why: When everything is vermillion it stops meaning "act here"; today is least distinguishable when it matters most.
- Fix: Hero to text-6xl/7xl; historical bars bg-[#1A1A1A] fill, reserve #FF3D00 for today's bar; drop the dot.
- Command: layout

## Persona Red Flags

- Alex: zero efficiency affordances on his landing page — no deep links from stats, no polling toggle; tabIndex={0} chart puts a stop in tab order that does nothing (pure tab tax).
- Sam: P0 focus-ring miss on primary CTA; raw technical errors announced assertively via role="alert"; Retry buttons ~36px below 44px minimum.
- Jordan: "Outstanding" ambiguous; zero-state offers no next step; Membership card says same thing three times.
- Riley: DB down at 6am → vendor jargon + unlimited manual retry loop; stale-refresh keeps old numbers without dimming them — hurried owner can quote yesterday's revenue as today's.

## Minor Observations

Timezone seam INFERENCE: today-highlight uses phDateToday() while repo buckets by browser-local dates — near midnight on non-PH devices the dot can land on the wrong bar; loading placeholder is single card that becomes four (reflow); lone Stat in multi-slot row reads unfinished; title attributes duplicate printed counts; #737373 text-xs ~4.6:1 contrast skims AA floor; demo notice quieter than footer copyright; heroButtonClass duplication caused the P0.

## Questions to Consider

1. If the owner sees exactly one number before answering a phone call, is it check-ins today — or Outstanding?
2. The spec's hero scale reaches 160px; this page's biggest number is 36px. Is Bold Typography allowed here?
3. Would "+18% vs same day last week" change the owner's morning?
4. Demo mode presents invented numbers indistinguishably from real ones — is one gray sentence preventing a screenshot of fake revenue?
5. Every other page learned the error lesson. Why did the dashboard miss the memo — is error handling copied per-feature instead of shared?
