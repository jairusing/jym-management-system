---
target: Members page (MembersPage.tsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T06-54-13Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Critique: Members Page (MembersPage.tsx) — 2026-08-17

**Method: dual-agent (A: ses_ff18c4b2dffeQMK6sOAeg2006m · B: ses_ff18c1308ffeqAOheG9GYlxTWb)**

## Design Health Score: 25/40 — Acceptable (62.5%)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good label swaps + green confirms; QR "Generating…" hangs forever on toDataURL failure (no catch) |
| 2 | Match System / Real World | 3 | Gym language authentic; "Create login"/"Link existing" are internal jargon |
| 3 | User Control and Freedom | 2 | Escape closes the menu but not the inline panels; Delete has no undo |
| 4 | Consistency and Standards | 3 | Tokens disciplined; native window.confirm is the odd one out |
| 5 | Error Prevention | 2 | Delete's default-focused OK + Enter confirms a permanent deletion |
| 6 | Recognition Rather Than Recall | 3 | Statuses inline; Pause/Cancel/Deactivate/Delete need the confirm dialog to disambiguate |
| 7 | Flexibility and Efficiency | 2 | Role-adaptive menus good; no shortcuts, no bulk, QR two clicks deep |
| 8 | Aesthetic and Minimalist Design | 3 | Stunning and disciplined; density exceeds "one action per view" |
| 9 | Error Recovery | 2 | Failed delete error renders inside the Add-member card — wrong part of the page |
| 10 | Help and Documentation | 2 | Panel microcopy great; page description generic, no field-level help |

## Design Specificity Verdict

Authored for this product, not category-interchangeable. Consequence-literate confirms ("check-ins will be blocked immediately"), domain-native states (expiring in amber, paused in ink), role-gated authority as a visible trust boundary. Weakest moment: destructive flows delegated to the OS (window.confirm).

Deterministic scan: 0 findings (exit 0) on MembersPage + RowMenu/PageShell/SectionCard — control-verified functional. Coverage note: copy-level and rendered-layout checks do not run on .tsx. No visual overlay: no browser automation in this harness (fallback signal reported).

Cross-checks: A's chip-selection claim was a false alarm (shared chipClass inverts to Warm Paper per spec). Both P0s verified in source.

## Priority Issues

- P0 — Native window.confirm gates permanent actions (MembersPage.tsx:199,226,239): default-focused OK, Enter confirms un-undoable Delete; breaks system immersion. Fix: in-app modal, Cancel pre-focused, vermillion danger, keep consequence copy.
- P0 — Silent mock-data fallback in production (MembersPage.tsx:107-109): Supabase listMembers() throw renders mock members with working QR panels. Fix: real error state with Retry when Supabase is configured; never render mock rows.
- P1 — More menu: 8 items, no grouping, destructive mid-list (MembersPage.tsx:550-621). Fix: hairline group dividers, destructive pinned bottom.
- P1 — Inline panels reflow the list; Save falls below fold (MembersPage.tsx:625-781). Fix: anchored popover or scrollIntoView + fixed height.
- P2 — Page-level errors render in the wrong card (:446); new member not surfaced after add. Fix: per-surface error state / role=alert anchored to action; scroll+highlight new member.

## Persona Red Flags

- Alex (power user): Set PIN 2 clicks deep in 8-item menu; panel reflow tax on every row; no indicator where new member landed after add.
- Sam (accessibility): RowMenu is role=menu/menuitem with no ArrowUp/Down navigation (APG violation); focus orphaned on close; trigger name lacks member context; chips lack aria-pressed; errors/successes lack role=alert; login/link panels don't submit on Enter (PIN panel does); window.confirm hostile to SR users.

## Minor Observations

- QR "Generating…" never resolves if toDataURL rejects (no catch at :260)
- "Loading…" whisper-gray, no aria-live
- Add form: 5 fields, no required-field hints
- Row density (4 meta lines + 2 controls + 8-item menu) stretches "one action per view"

## Questions to Consider

- What if Delete required typing the member's name?
- What if the new-member card was highlighted the moment it appears?
- Does "Create login" deserve a front-desk word instead?
