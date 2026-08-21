---
target: Check-ins page (round 14 re-critique after v1.030)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
p2_count: 3
p3_count: 1
timestamp: 2026-08-21T07-17-10Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Check-ins Page — Critique Round 14 (v1.030)

Method: dual-agent (A: ses_fdcd8fbbaffevOY5n7zZinx643 · B: ses_fdcdc86e3ffeMTKqXdIMt9nwWo)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Busy labels everywhere, but Enter on the primary field can silently do nothing; success still renders at card top |
| 2 | Match system / real world | 3 | Dated grace copy operator-perfect; raw Supabase strings leak developer language; "EXPIRING" labels an already-expired membership |
| 3 | User control & freedom | 3 | Cancels everywhere; stale PIN digits survive "Incorrect PIN."; success/error persist across tabs |
| 4 | Consistency & standards | 3 | Shared vocabulary strong; History breaks the amber LoadError pattern; amber container means both warning and error |
| 5 | Error prevention | 3 | Layered gates with reasons; override is explicit second commitment; but some prevention is silent no-op |
| 6 | Recognition over recall | 3 | Live filtering + inline badges; the Enter hint appears only in empty-query state and vanishes when the behavior applies |
| 7 | Flexibility & efficiency | 2 | Flagship keyboard accelerator unreliable; no autofocus; Tabs lack arrow-key roving |
| 8 | Aesthetic & minimalist | 3 | Disciplined system intact; dead sm:grid-cols-3 scaffold; vermillion at its ceiling |
| 9 | Diagnose & recover | 3 | Domain errors specific; LoadError+Retry only on 2 of 3 tabs; infra errors arrive raw with no lever in History |
| 10 | Help & documentation | 3 | PIN policy taught inline; nothing documents CSV contents or grace rule source |
| **Total** | | **29/40** | **Acceptable** |

Score note: below round 13's 32 despite all four v1.030 fixes landing (detector-verified). Fresh-eyes weighting found the merge left the flagship Enter interaction with a silent failure mode — and silent failures cost more at a front desk than loud ones. Earlier rounds under-weighted this pre-existing flaw; the unified field made it the primary path.

## v1.030 Fix Verification

| Fix | Verdict | Evidence & caveats |
|---|---|---|
| Green success #22C55E | Landed cleanly | Line 28 role="status" + text-[#22C55E] |
| RowMenu replaces Delete wall | Landed, one gap | Today 649-660, History 730-741, danger:true, restoreFocusId wired; BUT focus restore works only on cancel — on success the row unmounts and focus drops to body |
| Merged single input | Landed, one gap | One field, exact-ID → QR path with PIN intact, else filter+focus; BUT focus() silently no-ops when first match has no rendered/enabled button |
| LoadError amber panel | Landed, partial | Lines 33-44 match PIN panel grammar; BUT History tab still uses bare red StatusLine for its load failures |

Deterministic scan: detector exit 0, 0 findings on CheckInsPage/buttonClasses/RowMenu. 0 #DC2626. Ring utilities on all four classes. Grace amber in both row blocks. 0 rounded/shadow/gradient. All 12 page buttons labeled; RowMenu trigger labeled ("More"). Hex census: #A3A3A3 x17, #FAFAFA x6, #FFB300 x5, #262626 x4, #FF3D00 x3, #1A1A1A x3, #22C55E x1 — all on-palette. RowMenu trigger itself has no focus-visible utilities (browser default outline).

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

All four v1.030 fixes are real and verified. But the batch's centerpiece — one field, Enter-driven — now carries the page's worst flaw: pressing Enter can silently do nothing exactly when the first match can't be checked in. The score reflects honest re-weighting, not regression: the same no-op existed in rounds 11-13 but was buried under louder issues.

## What's Working

1. Decision-ready membership copy (158-183): badge tone, button enablement, and explanation agree with concrete dates.
2. Learnable attention-panel grammar: amber-on-raised shared by LoadError and PIN panel; prefers-reduced-motion respected.
3. The merged entry field is the right product decision: one placeholder teaches both modes; exact-ID routing preserves the PIN gate structurally.

## Priority Issues

### P1 — Enter-to-select silently no-ops on the primary path
- What: handleEntrySubmit (197-210) focuses checkin-button-{id}, but the button is not rendered when already checked in today (460/524) and disabled when inactive/expired-blocked (465/529). getElementById → null or focus() on disabled → zero feedback.
- Why: Flagship interaction of the highest-frequency admin surface fails in silence; staff will distrust the shortcut or assume success.
- Fix: Fall back to the next actionable match; if none, say why inline ("All matches are already checked in or blocked"); announce the focus move via role="status".
- Command: harden

### P2 — Focus abandoned after successful delete
- What: ConfirmModal restores to checkin-menu-{id} (764), but on success the row unmounts — target and fallback vanish; focus drops to body.
- Why: Keyboard/SR users ejected mid-task, twice per cleanup session.
- Fix: On success move focus to the next surviving row's trigger (or card heading).
- Command: harden

### P2 — History gets a lesser error experience; infra errors speak JSON
- What: loadHistory failures render bare red StatusLine (118) — no amber panel, no Retry; e.message strings surface verbatim across repos (101, 258, 274, 302, 344).
- Why: Inconsistent recovery confuses; raw strings get screenshotted for "IT is broken."
- Fix: Reuse LoadError in History; map repo errors to human copy, demote detail to console.
- Command: polish

### P2 — Touch targets violate the binding spec
- What: RowMenu trigger ~32px (RowMenu.tsx:113); text buttons py-2 ~36px; UI_DESIGN.md mandates 44x44 minimum.
- Why: Front-desk tablets are first-class; sub-spec targets mis-tap precisely on destructive items.
- Fix: Expand hit areas without changing visual size.
- Command: polish

### P3 — Drift-prone duplication + control debts
- What: Two near-identical 55-line row blocks with visible formatting drift; stale PIN digits after error (299); no autofocus; Tabs lack roving/aria-controls; dead sm:grid-cols-3 scaffold (554).
- Fix: Extract MemberRow; clear pinValue on failed verify; autofocus on mount; roving tabindex.
- Command: shape

## Persona Red Flags

- Alex: Enter dead-end forces mouse rescue; no autofocus costs a click every session.
- Sam: raw Supabase strings alarm; disappearing Enter hint teaches then unteaches.
- Jordan: Tabs ignore arrows; focus dumped to body after successful delete; least reliable control is the accelerator he'd adopt.
- Riley: ~32-36px targets below 44px spec with danger item in the smallest; success fires off-viewport.

## Minor Observations

Dead sm:grid-cols-3 wrapper (554); "most recent members" claim depends on unverified listMembers sort order; type="search" native clear glyph cracks sharp edges; two red badges can stack; verifyMemberPin('') probe costs a round-trip per manual check-in; GRACE_DAYS/membershipExpiry recreated every render; QrScanner lacks scan reticle; caps footnotes consistent and honest.

## Questions to Consider

1. If Enter is a promise printed in your own copy, what does one silent failure teach staff about trusting everything else?
2. At what density does vermillion's "one voice" become "no voice"?
3. Why did the amber attention panel ship to two of three tabs?
4. Where does a screen-reader user land when the deleted row takes their focus — is body an answer you'd defend?
5. Is "most recent members" a promise the query keeps?
