---
target: Check-ins page re-run after round 6 fixes
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-18T08-00-45Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Check-ins Page — Critique Round 2 (post round-6 fixes)

Method: dual-agent (A: ses_fec2510bdffe7MzGHs5Rykiibx · B: ses_fec24fe94fferRrMKKf3pU1qRT)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Banners sit above the Tabs, off the action; error+success can announce together |
| 2 | Match System / Real World | 4 | Plain gym language throughout — "member", "QR", "grace period" |
| 3 | User Control and Freedom | 4 | Cancel everywhere, Escape/backdrop on modal, scanner cancel |
| 4 | Consistency and Standards | 2 | Duplicate primaries for one action; amber-as-chrome; Tabs lack arrow keys |
| 5 | Error Prevention | 3 | Strong pre-checks; uniqueness relies on client state (stale across desks) |
| 6 | Recognition Rather Than Recall | 4 | Recent-5 list, badges, method tags — nothing to memorize |
| 7 | Flexibility and Efficiency | 2 | Enter is dead in both search and QR input; no keyboard nav of results |
| 8 | Aesthetic and Minimalist Design | 2 | Vermillion wall: 7+ loud actions competing on the Check-in tab |
| 9 | Error Recovery | 3 | Specific messages, in-dialog retries; "Incorrect PIN." dead-ends |
| 10 | Help and Documentation | 2 | Page description only; disabled states never explain themselves |
| **Total** | | **29/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** The skeleton is unmistakably authored — grace-period expiry logic, per-member PINs, QR-by-member-ID, manual/qr method tags in the label voice, hairline rows, text-only vermillion CTAs. But the moments that carry the most meaning drift category-generic: two identical loud primaries for one outcome ("Scan QR" + "Check in via QR"), bare `<p>` feedback banners, amber status color used as decorative panel chrome, and a status ("Checked in today") wearing a dead control's clothes. The One Voice Rule and one-meaning-per-color are the two rules this screen quietly refuses.

**Deterministic scan:** detect.mjs ran clean — 0 findings across all 7 files (CheckInsPage, QrScanner, ConfirmModal, Tabs, SectionCard, StatusBadge, buttonClasses), exit 0 each. A positive-control test (temp file with intentional violations) fired 3 findings, so the clean result is genuine. Caveat: the .tsx rule set is regex-telltale only, so "clean" ≠ "no visual anti-patterns."

**Visual overlays:** skipped — no browser automation tool available in this environment; no overlay was injected.

## Overall Impression

Round 6 landed all four fixes — live regions, PIN panel placement, ConfirmModal delete, pre-check — and the score moved 21 → 29. But the round introduced its own regression (error+success banners coexisting) and the page's loudest problem remains: the check-in screen is screaming in vermillion, and the status feedback that matters still lives above the fold while the action is mid-card.

## What's Working

1. **State truth at the action** — the beginCheckIn pre-check (CheckInsPage.tsx:178) plus the row relabel/disabling means "already in" is visible exactly where the click happened, on both manual and QR paths.
2. **High-stakes flows are guarded** — the delete modal's danger variant: Cancel autofocused, Escape/backdrop locked while pending, in-dialog errors, "Deleting…" pending label, Tab trap.
3. **Token discipline in the quiet 90%** — hairlines, label-voice method tags, sharp inputs, prefers-reduced-motion respected in the PIN scroll.

## Priority Issues

**P0 — Feedback detached from the action, and can contradict itself.** Banners render above the Tabs (CheckInsPage.tsx:305-306) while every operation happens mid-card; worse, completeCheckIn sets success *before* refreshTodayCheckIns() (checkins:221-227) and a refresh failure leaves white + vermillion text stacked. *Fix:* move the status line into the SectionCard; clear the other banner before setting one. → /impeccable clarify

**P1 — Focus lost after ConfirmModal closes.** No focus restoration on cancel (focus drops to body when the autofocused Cancel unmounts) or success (row unmounts). For a keyboard/SR user in a 200-row history list that's a full orientation reset — v1.013 fixed this for RowMenu but missed ConfirmModal. *Fix:* capture the Delete trigger on open, restore on close. → /impeccable audit

**P1 — Dead Enter keys.** handleSearch only calls preventDefault (CheckInsPage.tsx:159) and the QR input isn't in a form — Alex types a name or scans, hits Enter, nothing happens. *Fix:* Enter in search checks in the first result; wrap the QR input in a submitting form. → /impeccable harden

**P2 — The vermillion wall.** Scan QR + Check in via QR are both primaries (checkins:334-341) plus per-row Check in buttons plus Verify PIN — 7+ same-voice actions. The One Voice Rule (DESIGN.md) is the product's identity. *Fix:* scanning auto-submits on decode; demote "Check in via QR" to ghost. → /impeccable quieter

**P2 — "Checked in today" is a state wearing a control's clothes.** Disabled ghost button at opacity-50 ≈ 3:1 contrast (sub-AA) with pointer-events-none. *Fix:* render it as a green good-tone StatusBadge in the label voice, not a dead button. → /impeccable polish

**P3 — PIN panel token violations.** Amber #FFB300 as decorative chrome (third voice), a 3-column grid holding one input, and the input's accessible name is just "PIN" — a screen-reader user can't tell whose. *Fix:* hairline + slate surface, collapse the grid, aria-label="PIN for {name}". → /impeccable polish

## Persona Red Flags

- **Alex (power user):** Enter does nothing in either input; no keyboard navigation of results; the duplicate QR CTAs add a keystroke to the fastest path; checking in requires Tab-trawling identical buttons.
- **Sam (screen reader/keyboard):** focus dropped to body after modal close; role=tablist with no arrow keys or aria-controls; PIN input announced as just "PIN"; "Checked in today" below AA contrast; scanner overlay has no role=dialog, no trap, no Escape.
- **Riley (stress tester):** duplicate protection is client-state — two desks with stale checkIns can both pass the pre-check; wrong-row tap risk with identical buttons, and recovery is 3 steps away.

## Minor Observations

- "already checked in today." (client) vs "Already checked in today." (repo) — inconsistent case
- QrScanner's Cancel uses bespoke classes duplicating but not matching outlineButtonClass
- SectionCard description order ("by name, scan, or ID") doesn't match layout order (QR first)
- PIN panel: no attempt count, maxLength={6} with no guidance
- History tab: vermillion Delete on every row + Load + Export — a third loud screen
- verifyMemberPin(member.id, '') empty-string probe is a fragile contract

## Questions to Consider

1. If scanning already feeds the check-in flow end-to-end, why does the screen show two vermillion CTAs for one job?
2. Two desks, same member, same second — what actually stops the double check-in: the client pre-check or the database?
3. When a member's already in, is "Checked in today" a button or a status?
