---
target: Check-ins page (round 13 re-critique after v1.029)
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
p2_count: 3
p3_count: 1
timestamp: 2026-08-21T06-50-56Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Check-ins Page — Critique Round 13 (v1.029)

Method: dual-agent (A: ses_fdcf15036ffew62uM3TFXauazu · B: ses_fdfa20e2effexemLEJugMYJVU6)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Focus step now visible; but success is still white body text at card top while action happens mid-list |
| 2 | Match System / Real World | 3 | Grace copy excellent; "Check in via QR" ambiguous vs "Scan QR"; empty state ignores phone/email matches |
| 3 | User Control & Freedom | 3 | Cancels everywhere; no way to clear search, stale success persists across tabs, stale PIN digits |
| 4 | Consistency & Standards | 3 | Amber/red semantics now correct; RowMenu unused (bare per-row Delete); two adjacent forms have opposite Enter behaviors |
| 5 | Error Prevention | 4 | Ring makes two-step perceivable; guards layered; override-without-friction is a recorded user decision |
| 6 | Recognition Rather Than Recall | 3 | Recent-5 + named PIN panel strong; no live result count; duplicated row JSX is a drift risk |
| 7 | Flexibility & Efficiency | 3 | QR fast path + documented keyboard path; neither input autofocuses on mount |
| 8 | Aesthetic & Minimalist | 3 | Clean surface intact; vermillion oversaturated (CTAs, errors, LoadError, Delete walls share one voice) |
| 9 | Error Recovery | 4 | Honest LoadError + Retry, PIN retry loop, in-modal delete error |
| 10 | Help & Documentation | 3 | Enter path taught in copy; raw Supabase error strings can surface verbatim |
| **Total** | | **32/40** | **Good** |

Up from 31: both round-12 P1 fixes earn real points (Error Prevention 3→4, semantic consistency restored). Score capped because every round-12 P2 survived untouched.

## Round-12 Fix Verification

| Fix | Verdict | Evidence |
|---|---|---|
| Focus-visible ring | Landed exactly per spec | All four classes in buttonClasses.ts carry focus-visible:ring-2 ring-[#FF3D00] ring-offset-2 ring-offset-[#0A0A0A]; matches UI_DESIGN.md:236 precisely; offset keeps ring legible even when idle text is already vermillion |
| Amber grace semantics | Landed | Grace members get tone="warning" amber "Expiring" badge + amber message; red reserved for paused/cancelled/past-grace |
| ≤1 red badge per row | Claimed, not enforced | Inactive member past grace renders TWO red badges ("Inactive" + "Expired"); nothing caps red at one |
| Helper copy | Landed | "type to search, press Enter to select, then Check in." |

## Design Specificity Verdict

Product-specific, with the same generic leaks round-12 flagged — none newly introduced, none cleaned up. QR/member-ID entry, named-PIN gate with staff override, 3-day grace logic with dated explanation, method micro-labels, PH-timezone CSV export. Leaks persist verbatim: two near-identical stacked inputs, vermillion Delete underline on every row of two tabs, white success text, LoadError camouflaged against its own card.

**Deterministic scan:** Detector exit 0, 0 findings on CheckInsPage, buttonClasses, StatusBadge. 0 #DC2626. Ring utilities confirmed on all four button classes. Grace amber verified in BOTH row blocks (tone pattern lines 460/524, 'Expiring' at 467/531, text-[#FFB300] at 475/539). 0 rounded/shadow/gradient. All 16 buttons have text; 0 icon-only. PIN override markup accessible. Hex census: #A3A3A3 x17, #FAFAFA x7, #262626 x6, #FFB300 x4, #FF3D00 x3, #1A1A1A x2, #0F0F0F x1 — all on-palette.

**Visual overlays:** Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

The two P1 fixes are real craft — the focus ring solves the hard case (vermillion-on-vermillion legibility via offset) and grace semantics now match the operator's decision. But the score is capped by the same four P2s that have survived two rounds unchanged: white success, Delete wall, twin inputs, LoadError camouflage. They account for all three cognitive-load failures.

## What's Working

1. The focus ring is implemented exactly right — spatially separated by offset so it reads even on buttons whose idle text is already vermillion.
2. Grace semantics match the decision the operator must make — badge color, button enablement, and explanation all agree.
3. Recovery is layered and honest — LoadError + Retry, PIN retry with inline error, delete errors surfaced inside the modal.

## Priority Issues

### P1 — Success confirmation doesn't register as success, and may not be seen at all
- What: Line 26 text-[#FAFAFA] success line, identical to row names; renders at card top while the clicked button sits mid-list; can be a full viewport away on mobile.
- Why: Confirmation is the payoff that prevents re-check-ins and double-counts. A white sentence in a page of white sentences is not a signal.
- Fix: Use good token #22C55E for success text (errors stay vermillion); render feedback adjacent to the triggering row or sticky.
- Command: colorize

### P2 — The Delete wall: vermillion destruction on every row, while RowMenu sits unused
- What: Both Today and History render dangerButtonClass DELETE on every row (up to 210 times). RowMenu.tsx is the app's row-action pattern and isn't imported here.
- Why: Scanability (eye trips over vermillion non-action on every line) + safety (destructive audit-worthy action gets equal weight to Check in).
- Fix: Replace per-row Delete with RowMenu containing a danger:true "Delete" item; keep ConfirmModal.
- Command: shape

### P2 — Twin inputs with divergent Enter contracts
- What: QR/member-ID form and Search form stack two visually identical inputs; Enter behaves differently six inches apart.
- Why: Mode confusion is the highest-frequency friction — pasted name in QR field errors out.
- Fix: One entry field routing names to search and exact IDs to check-in.
- Command: shape / layout

### P2 — LoadError is camouflage
- What: bg-[#0F0F0F] border-[#262626] pixel-identical to SectionCard surface.
- Why: A load failure that looks like whitespace gets missed; staff proceed on a blank list.
- Fix: Amber border + raised surface (border-[#FFB300] bg-[#1A1A1A]) — pattern already used by the PIN panel.
- Command: polish

### P3 — Tabs lack arrow-key roving and tablist wiring
- What: role="tablist"/"tab"/aria-selected present, but no aria-controls, no tabpanel association, no arrow-key roving.
- Why: Tab semantics without tab behavior. Low severity (3 tabs, Tab key works).
- Fix: Roving tabindex + arrow-key handler + aria-controls.
- Command: harden

## Persona Red Flags

- Alex: double-Enter trap closed. Remaining: no autofocus on mount, stale QR after failed check-in, success feedback fires offscreen.
- Sam: PIN panel unannounced (not landmark/live region); Tabs have roles without behavior; success has role="status" (good) but white styling gives sighted peers nothing.
- Jordan: grace members read consistently now. Residual: Inactive+Expired can stack two red badges; raw Supabase error strings.
- Riley: PIN override one click, no record (deferred by user decision). Delete wall compounds audit concern.

## Minor Observations

- Duplicate member-row JSX still fully duplicated; indentation drift shows copies diverging. Extract MemberRow before next fix lands twice.
- Correction to round-12: duplicated checkin-button IDs do NOT co-exist (branches mutually exclusive) — no live ID collision.
- From > To silently no-ops; "Incorrect PIN" leaves stale digits; "in 3-day grace until" grammar; ~34px touch targets below 44px spec; verifyMemberPin('') network round-trip per check-in; GRACE_DAYS/membershipExpiry redefined every render; vermillion doing seven jobs (near ceiling of 5-10% guidance); success/error state shared across tabs.

## Questions to Consider

1. Should Enter simply open the PIN-style committed panel for the first match, making the guard structural rather than visual?
2. If vermillion means CTA, error, delete, focus, alert, and brand all at once — at what point does "one voice" become "no voice"?
3. Is deleting a check-in a routine row op, or rare enough to belong behind a menu?
4. Would a transient toast anchored to the row change the error rate more than any color change?
5. Both rounds found the same four leaks — what would it take to close them as one batch instead of letting them roll into round 14?
