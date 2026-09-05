---
target: Auth page (round 1 critique after v1.047)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-08-24T16-07-24Z
slug: apps-web-src-features-auth-authpage-tsx
---
# Auth Page — Critique Round 1 (v1.047)

Method: dual-agent (A: ses_fcb7be1c5ffe2WOSf2gU8VznDP; test-file skim for behaviors)

Score 23/40 (Poor→Good boundary). H1 3 | H2 2 | H3 3 | H4 2 | H5 2 | H6 3 | H7 2 | H8 3 | H9 1 | H10 2

Verdict: solid token-consistent tri-mode flow with correct autocomplete and PKCE confirmation handling, but it leaks developer framing and raw Supabase errors onto a public gate.

Deterministic facts: raw error.message rendered at :88/:107; "Phase 1"/"Authentication foundation"/env-var copy public (:150-157); submit buttons not disabled while loading (:180/:237); no focus-visible rings on this page's buttons; reset mode title bug ("Create account" ternary misses third mode, :151).

Priority issues:
- P1 Raw Supabase errors on the PUBLIC gate → map codes to human copy; special-case 429 rate-limit.
- P1 Buttons stay enabled during loading; no focus rings → disabled + ring per DS.
- P2 Reset-mode renders wrong title (ternary gap).
- P2 Internal/dev copy publicly visible ("Phase 1", env message).
- P2 No password visibility toggle; no client-side length check before round-trip.
- P3 Errors lack role="alert"; no resend-confirmation link; post-login ignores location.state.from.

Strengths: correct autocomplete incl. current/new-password split; robust confirmation-link exchange + anti-enumeration reset copy.
Browser unavailable. Trend: first run.
