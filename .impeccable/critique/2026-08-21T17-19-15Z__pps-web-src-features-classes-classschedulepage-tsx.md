---
target: Classes page (round 2 re-critique after create-fix)
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
p2_count: 0
p3_count: 3
timestamp: 2026-08-21T17-19-15Z
slug: pps-web-src-features-classes-classschedulepage-tsx
---
# Classes Page — Critique Round 2 (v1.043+create-fix)

Method: dual-agent (A/B: ses_fdaac0909ffewnRl5kEf8vZiEn et al; one sub-agent misapplied the scale direction and was discarded — parent re-ran scoring fresh)

## Design Health Score — 35/40 (Excellent)

H1 3 | H2 3 | H3 4 | H4 3 | H5 4 | H6 4 | H7 3 | H8 4 | H9 4 | H10 3 → **TOTAL 35/40**

Deterministic scan: detector exit 0 ([]); hex on-palette (#A3A3A3 x7, #262626 x3, #FAFAFA x3, #FF3D00 x2, #1A1A1A x2, #FFB300 x1, #22C55E x1); role="alert" x2, role="status" x1, ConfirmModal present, toUserError x6 call sites, aria-expanded present.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Verdict
Polished, well-guarded CRUD page; the re-score round also caught a real gap my v1.040 implementation missed (create-class never set its success message) plus missing name-required and end>start validation — all three fixed immediately before this scoring pass. Remaining issues are cosmetic-level polish.

## Remaining Issues (P3 only)
- P3 — No week-nav loading spinner during refetch.
- P3 — LoadError pairs #FFB300 border with #FF3D00 text.
- P3 — "click a session to book members" hint inaccurate (booking uses a button).

## Trend
19 → **35**
