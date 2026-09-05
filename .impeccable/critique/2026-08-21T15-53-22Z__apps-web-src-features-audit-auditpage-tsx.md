---
target: Activity log page (round 1 critique after v1.040)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
p2_count: 2
p3_count: 1
timestamp: 2026-08-21T15-53-22Z
slug: apps-web-src-features-audit-auditpage-tsx
---
# Activity Log Page — Critique Round 1 (v1.040)

Method: dual-agent (A: ses_fdb009c5cffeyMOVvK8vMc0u5U · B: ses_fdafc960dffetE5di80Mh6poX9)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 1 | Error path silently swaps in mock rows; only signal is a 14px red p below the card |
| 2 | Match system & real world | 2 | Labels read as sentences but unknown targetTypes leak raw ("deleted role_changes") |
| 3 | User control & freedom | 1 | No Retry, no filter reset, no escape from a bad load |
| 4 | Consistency & standards | 1 | Violates amber LoadError pattern; void=amber contradicts token table (spec: void = gray) |
| 5 | Error prevention | 3 | Nothing destructive; safe by construction |
| 6 | Recognition over recall | 2 | Absolute-only timestamps force mental math |
| 7 | Flexibility & efficiency | 1 | Zero search/filter/export; scales by eyeballs not tools |
| 8 | Aesthetic & minimalist | 3 | Restrained two-weight row anatomy, fully on-token |
| 9 | Recognize/recover from errors | 1 | Raw exception text, wrong color, no role="alert", no recovery action |
| 10 | Help & documentation | 2 | Good scope description; silent on retention/window limits |
| **Total** | | **17/40** | **Poor** |

## Design Specificity Verdict

On-brand skin, off-standard bones. Visually obeys Bold Typography. Functionally generic and non-compliant with the app's own failure-state standards: it INVENTS audit data on error — the most trust-dependent page in the app is the least trustworthy when things go wrong.

Deterministic scan: detector exit 0 ([]); hex on-palette (#A3A3A3 x3, #FF3D00 x1, #FAFAFA x1, #262626 x1); #DC2626 absent; rounded/shadow/gradient 0. Confirmed absences: role="alert" 0, LoadError 0, Retry 0, focus-visible 0, aria-pressed 0, chipClass 0; mockAuditRepository referenced x3 (lines 8/30/39); raw e.message x1 (line 40). Repository facts (B): AuditAction = 'delete' | 'void' ONLY (the reviewer's inference about undo/role-change entries was incorrect — corrected); listAuditEntries is UNBOUNDED (mock returns entire array sorted desc).

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

The owner opens this page under suspicion after an incident. On a bad network day it hands them FABRICATED history with a bottom-whisper error — in an immutable-audit context that is a trust-termination event, worse than a blank error. Arc: vigilant → briefly reassured → stranded.

## What's Working

1. Honest concept-naming empty state: "No destructive actions have been recorded yet" teaches the mental model.
2. Plain-language event sentences ("voided invoice (INV-…)" with actor · timestamp) plus truthful "Unknown account" fallback.
3. Token discipline: StatusBadge/SectionCard/PageShell reuse only; console.warn correctly present; nice responsive badge alignment.

## Priority Issues

### P0 — Fabricated audit history replaces failure state
- What: On Supabase error, mock entries load and render as real (line 39); no-config case renders mock with no notice at all (29-33).
- Why: Showing invented voids/deletes can trigger real accusations against real staff.
- Fix: Never call mockAuditRepository on the configured path; amber LoadError panel (role="alert", human copy, ghost Retry); explicit "Not connected" state for no-config.
- Command: harden

### P1 — Raw e.message, wrong color, no announcement, no Retry
- What: Line 40 captures e.message; line 83 prints it as red text below the card; no live region; no Retry.
- Fix: "Couldn't load activity. Check your connection and try again." in amber panel above the list with Retry.
- Command: harden

### P2 — Action vocabulary is exhaustive-unsafe
- What: actionTone/actionLabel (11-21) handle exactly delete|void; unknown values fall through to "deleted <raw>" prose (e.g. "deleted role_changes").
- Why: Mislabeled audit events are factual corruption in prose form.
- Fix: Exhaustive Record keyed to the repository union ('delete' | 'void') with a safe verbatim fallback branch.
- Command: harden

### P2 — Severity tones contradict the token table
- What: void→amber warning though spec assigns void gray; every successful historical delete renders red.
- Why: One-meaning-per-color broken; trains alarm fatigue on a factual record.
- Fix: void→neutral; document the delete-tone decision in UI_DESIGN.md.
- Command: polish

### P3 — Zero investigative tools; unbounded list
- What: No filters/chips/search/pagination/count; listAuditEntries unbounded; chipClass+aria-pressed standard unused by omission of the feature.
- Fix: Action-type chips (aria-pressed, 44px), count header, bounded window or server-side pagination (D5-adjacent).
- Command: shape

## Persona Red Flags

- Alex: no search/filter/export/deep-link; abandons page for SQL after one week.
- Sam: error invisible to AT; mock vs real indistinguishable; severity by color alone; unbounded list hostile to rotor nav.
- Jordan: "Recent" window vs complete record ambiguity — may conclude no older actions exist.
- Riley: worst case realized — Supabase down mid-incident → fabricated history, no retry, 10k-row ul threatening tab freeze.

## Minor Observations

Bare-text loading (skeleton would kill layout shift); absolute-only timestamps (relative primary aids scanning); spec's JetBrains Mono for technical metadata unused; repo reconstructed per load; no abort/cleanup on unmount; error p orphaned outside the card without max-width; parenthesized details can double-parenthesize; no count or end-of-log marker.

## Questions to Consider

1. If a staff member says "I never deleted that member," does this page prove the truth — or hand them the fabrication defense?
2. Why did the app standardize amber-alert-plus-retry everywhere except the one page where failure is catastrophic?
3. Can the one question that brings someone here be answered in 30 seconds once the list passes 500 rows?
4. Should an audit log editorialize with color at all?
5. Is "Recent" a promise about scope or an apology for missing pagination?
