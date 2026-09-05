---
target: Classes page (round 1 critique after v1.039)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
p2_count: 1
timestamp: 2026-08-21T15-33-10Z
slug: pps-web-src-features-classes-classschedulepage-tsx
---
# Classes Page — Critique Round 1 (v1.039)

Method: dual-agent (A: ses_fdb120a30ffeJm70teVVA6PEv9 · B: ses_fdb0eddffffe2LoqX7wvfM8jqL)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 1 | setSuccess never populated with a message (5 call sites all pass null); no pending state on delete/cancel/generate; silent mock fallback fakes health |
| 2 | Match system & real world | 3 | "Materialize sessions" is dev jargon; mixed time format ("9:00 AM–10:00") |
| 3 | User control & freedom | 1 | Irreversible delete/cancel with no confirm or undo |
| 4 | Consistency & standards | 2 | Toggle lacks aria-expanded/pressed; cancelled=red breaks Phase 8 color semantics (spec: cancelled = gray) |
| 5 | Error prevention | 1 | No confirm on destroy, no end>start time check, no duplicate-member guard |
| 6 | Recognition over recall | 3 | Good empty-state copy points to the fix; member select offers no context |
| 7 | Flexibility & efficiency | 2 | Prev/next-only week nav, no member search, per-class scheduling click-by-click |
| 8 | Aesthetic & minimalist | 3 | Clean editorial rows; cancelled bookings linger as noise |
| 9 | Recognize/recover errors | 1 | Raw e.message x5 sites; errors render top-of-page far from triggering action |
| 10 | Help & documentation | 2 | Inline descriptions help; "Full" gives no waitlist/next-week path |
| **Total** | | **19/40** | **Poor** |

## Design Specificity Verdict

On-brand skin, off-brand behavior. Token fidelity high (#0A0A0A/#FAFAFA/#FF3D00, sharp edges, tracked underlined buttons), but three violations: no amber LoadError panel — Supabase failure silently swaps in mock data (:116-121); StatusBadge tone="bad" red for CANCELLED bookings contradicts UI_DESIGN.md's own mapping (cancelled = gray); buttons ~36px while chipClass proves the team knows the 44px rule.

Deterministic scan: detector exit 0 ([]); hex on-palette (#A3A3A3 x7, #FAFAFA x4, #262626 x3, #1A1A1A x1, #FF3D00 x1); #DC2626 absent; rounded/shadow/gradient 0. Confirmed absences: role="alert" 0, LoadError 0, RowMenu 0, ConfirmModal 0, focus-visible 0, aria-expanded 0, aria-pressed 0; window.confirm 0 (destructive actions have NO gate at all); raw e.message x5 (146/160/172/191/203); console.warn present. Verified: every setSuccess call passes null — success renders at :229 but is never populated.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

Strong start betrayed ending: exemplary empty states and stateful disabled labels, then silent destruction and fictional failure data. The peak-end rule is violated by both the destructive act and the mock-fallback failure mode. Every fix is again a port of existing patterns.

## What's Working

1. Exemplary empty states — "No classes yet. Add your first class above." and the scheduling hint tell the user exactly where the fix lives.
2. Stateful disabled labels — "Scheduled this week" / "Full" turn dead buttons into information.
3. Honest form ergonomics — wrapped labels, native time/number inputs with min, sensible prefills.

## Priority Issues

### P0 — Silent mock fallback on load failure
- What: Supabase errors caught, warned to console, replaced with mock repositories (:116-121).
- Why: Staff see fictional classes/bookings and make real decisions on fake data.
- Fix: error state + amber LoadError panel + Retry; remove fallback branch.
- Command: harden

### P0 — Destructive actions with zero confirmation
- What: Delete class fires immediately (:328-334); booking Cancel likewise (:429-435). No window.confirm, no modal, nothing.
- Why: One misclick destroys a recurring class and its sessions/bookings — unrecoverable.
- Fix: RowMenu + ConfirmModal with consequence copy (the app-wide pattern).
- Command: harden

### P1 — Raw e.message at five sites
- What: Handlers surface exception text verbatim (:146, :160, :172, :191, :203).
- Fix: Human copy per action ("Couldn't add the class…"), console.warn demotion.
- Command: harden

### P1 — Feedback detached and half-dead
- What: All messages render once at page top (:228-229); success is never populated; no role="alert"/aria-live.
- Why: Booking at list bottom shows nothing nearby; SR users hear nothing.
- Fix: Colocate feedback per SectionCard, add roles, actually emit success strings.
- Command: polish

### P2 — Toggle a11y, undersized targets, cancelled=red
- What: Book-a-member toggle lacks aria-expanded and focus management; buttons ~36px; cancelled bookings tone="bad" red instead of spec gray.
- Fix: aria-expanded + focus into panel on open; adopt muted treatment for cancelled rows.
- Command: polish

## Persona Red Flags

- Alex: no bulk "generate all sessions"; per-class clicking scales badly past ~15 classes.
- Sam: "Materialize sessions" means nothing; header says "click a session to book" but it's a button; unlabeled Delete terror.
- Jordan: 36px targets fail thumbs; errors appear scrolled out of view at page top.
- Riley: disclosure without aria-expanded, no focus into panel, no aria-live outcomes; rapid week-nav clicks can race stale responses onto the wrong week.

## Minor Observations

success state is write-only scaffolding; time format mixes locale-aware start with raw endTime slice; listBookings fetches ALL bookings every week change; class name input lacks required; capacity has no upper bound; no pending/disabled on delete/cancel (double-submit window).

## Questions to Consider

1. Who benefits when a failed backend quietly impersonates a working gym?
2. If deleting a recurring class evaporates next Tuesday's bookings, what does the member at the desk experience?
3. Is the never-set success state abandoned scaffolding, or proof nobody watched a user try this flow?
4. Would you trust this page to run a real Saturday morning, given its failure mode is fiction?
