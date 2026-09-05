---
target: Member statement page (round 1 scored critique after v1.047) DEGRADED
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
p2_count: 1
timestamp: 2026-08-24T16-13-01Z
slug: ps-web-src-features-ledger-memberstatementpage-tsx
---
# Member Statement Page — Critique Round 2 (v1.047)

⚠️ DEGRADED: single-context (sub-agent provider outage — reviewed in parent context)

Score 33/40 (Good). H1 3 | H2 4 | H3 3 | H4 4 | H5 4 | H6 4 | H7 2 | H8 3 | H9 3 | H10 3

Verdict: a trustworthy, well-stated ledger view — the D4 fixes (amber panel, distinct not-found copy, mock-fallback removal) all verified present; what's left is output affordances.

Verified facts (file read): amber #FFB300 panel + role="alert" on load failure with distinct 'Member not found.' copy ✓; mock only on unconfigured path ✓; statusTone map follows palette (void gray) ✓; balances color-coded red/green with labels ✓; sections chunked (membership history / invoices / payments) with honest empty states ✓.

Priority issues:
- P2 — transient load failure has NO Retry button (amber panel shows message only; user must manually reload the browser).
- P3 — no print/export of the statement (a statement you can't hand over).
- P3 — loading is bare text; outstanding/paid stat boxes reuse warning-panel styling for non-warning data.

Strengths: color-coded decision-ready balances; per-section honest empty states.
Trend: first formal critique (D4 fix round earlier had no score).
