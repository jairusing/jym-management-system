---
target: Staff page (round 1 critique after v1.038)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
p2_count: 2
timestamp: 2026-08-21T15-10-27Z
slug: apps-web-src-features-staff-staffpage-tsx
---
# Staff Page — Critique Round 1 (v1.038)

Method: dual-agent (A: ses_fdb30058dffeEffFvPCsmzy8hn · B: ses_fdb2bd1feffeMGupClRdoj6nGg)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 1 | On Supabase failure the page silently swaps in mock data (:38-41) — every later status signal is a lie |
| 2 | Match system & real world | 2 | Titled "Staff" but lists every signup incl. members; role capabilities never explained |
| 3 | User control & freedom | 1 | Role changes instant and irreversible; no undo, no revert path after self-lockout |
| 4 | Consistency & standards | 1 | No amber LoadError panel, no ConfirmModal, no RowMenu, no 2px ring on the select |
| 5 | Error prevention | 1 | Owner can demote themselves (and the last owner) to member with only a native confirm() |
| 6 | Recognition over recall | 2 | Email + join date shown, but E3 pollution forces recall of who is who |
| 7 | Flexibility & efficiency | 2 | No search/sort/filter; per-row native dialogs make multi-person changes tedious |
| 8 | Aesthetic & minimalist | 3 | Clean typographic rows; role badge beside every name adds mild noise |
| 9 | Recognize/recover from errors | 1 | Raw e.message rendered in accent vermillion, no role="alert", no Retry |
| 10 | Help & documentation | 3 | Signup-path hint genuinely useful, though orphaned below the card |
| **Total** | | **17/40** | **Poor** |

## Design Specificity Verdict

**Generic CRUD wearing the brand.** Executes the Bold Typography system faithfully (sharp corners, tracked labels, hairline rows), but it is a profile list, not an access-governance interface. Nothing answers "who can do what": no permission explanations per role, no guardrails on the most dangerous action in the app, no signal distinguishing real staff from stray signups (E3). Visually on-system, functionally off-mission.

Deterministic scan: detector exit 0 ([]); hex all on-palette (#A3A3A3 x7, #FAFAFA x2, #262626 x2, #FF3D00 x2, #1A1A1A x1); #DC2626 absent; rounded/shadow/gradient = 0. Confirmed absences: role="alert" 0, LoadError 0, RowMenu 0, ConfirmModal 0, focus-visible 0; window.confirm x1 (line 52); raw e.message x1 (line 62); console.warn present (39). 141 lines total.

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

The weakest surface in the app. Every standard the rest of the codebase learned — honest load errors, human copy, gated destruction, consistent patterns — was never ported here. On an access-control page of all places, a failed load silently shows fictional accounts and role edits evaporate against mock data.

## What's Working

1. Typographic row design is excellent — name + tracked badge + muted email/join-date creates a scannable three-layer hierarchy honoring the spec.
2. Honest access gating for non-owners — clear SectionCard with plain-language reason, not a hidden route or blank screen.
3. Repository abstraction done right (interface + mock + Supabase) keeps the page testable; RowMenu component itself remains strong a11y work even though unused here.

## Priority Issues

### P0 — Silent fallback to fictional data
- What: On any Supabase load failure the catch block swaps in mock profiles (:38-41) with zero visual difference.
- Why: This is an access-control page — the owner reviews real privileges against fake rows; role changes "save" and evaporate.
- Fix: loadError state + amber LoadError panel with Retry; mock only for the no-config dev path.
- Command: harden

### P0 — Owner can demote themselves / the last owner
- What: Role select allows changing any row including the acting owner's own account to member; only window.confirm stands in the way (:51-54).
- Why: One slip locks the gym out of owner capabilities with no recovery narrative in-app.
- Fix: Block self-demotion and last-owner demotion in UI + repository; use ConfirmModal with consequence-stated copy.
- Command: harden

### P1 — Raw e.message as brand alarm
- What: Errors render e.message verbatim in vermillion (:62, :72) with no role="alert", no Retry.
- Why: Raw Postgres text styled like a CTA at the worst moment; violates app-wide standard.
- Fix: Human copy + console.warn + amber panel + Retry.
- Command: harden

### P2 — E3 pollution: members listed under "Staff"
- What: Unlinked self-signup profiles appear alongside real staff with no filter or explanation.
- Why: The page cannot answer "who works here"; every scroll is a micro-decision.
- Fix: Filter to owner/staff by default with an explicit toggle to show unlinked member accounts, labeled as such.
- Command: shape

### P2 — Interaction patterns diverge from siblings
- What: Inline select + native window.confirm instead of RowMenu + ConfirmModal; select lacks focus ring.
- Why: Same action = same UI everywhere else; the native dialog feels like abdication at peak stakes.
- Fix: Adopt RowMenu (Change role items) + ConfirmModal with consequence copy.
- Command: shape

## Persona Red Flags

- Alex: no search/filter over an unbounded list polluted with members; multi-person role changes are tedious native dialogs.
- Sam: zero role="alert" announcements; select has no visible focus indicator; native confirm not announced gracefully by SRs.
- Jordan: "promote them here" hint assumes context; no explanation anywhere of what owner/staff/member may actually do.
- Riley: failed load = editing fictional data; self-lockout dead-end ends in "Owner access required" with no recovery story.

## Minor Observations

Signup-path hint orphaned below the card; no page-level count ("N accounts"); join date shown but never labeled; role badge adds mild noise next to every name; no empty state if list is empty.

## Questions to Consider

1. Should members appear on this page at all, or only owner/staff?
2. What SHOULD happen if the owner demotes themselves — is there any recovery path today?
3. Why does the most dangerous page in the app have the fewest guardrails?
