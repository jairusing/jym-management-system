---
score: 26
max: 40
na: 
p0: 0
p1: 2
timestamp: 2026-08-17T07-46-54Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Impeccable Critique — MembersPage (v1.013 round-3 re-run)

## Design Health Score: 26/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Modal lifecycle excellent; activate failures surface under the Add form; cancelled member still green "Active" |
| 2 | Match System / Real World | 3 | Right desk vocabulary; two "Active" filters mean different things; "Expired" filter includes no-membership |
| 3 | User Control and Freedom | 2 | Escape/backdrop gated on pending correctly; focus restore is inert dead code — keyboard users lose their place |
| 4 | Consistency and Standards | 2 | Token discipline strong; PIN panel is a div + hand-rolled Enter while login/link are forms; three error surfaces |
| 5 | Error Prevention | 3 | Consequence copy + Cancel-first danger modals; validation solid |
| 6 | Recognition Rather Than Recall | 3 | Paused badge lands; panels self-teach; two-filter model still demands recall |
| 7 | Flexibility and Efficiency | 2 | Enter submits forms; Add member below the fold; Statement link is a full reload; Prev/Next-only pagination |
| 8 | Aesthetic and Minimalist Design | 3 | Hairline grid disciplined; vermillion voice overload (5+ voices); 8-item menus |
| 9 | Error Recovery | 3 | In-modal retry + loadError/Retry real; stale activate error persists |
| 10 | Help and Documentation | 3 | Confirm copy explains consequences; no filter-semantics help |
| **Total** | | **26/40** | **Acceptable (25 → 27 → 26)** |

## Design Specificity Verdict

System-faithful in form (hairlines, 0px radius, text-only CTAs, word badges), system-unfaithful in voice discipline: the One Voice Rule is broken on a typical render — eyebrow, beta badge, selected chip, primary CTA, every error, every expired row, and every danger menu item are all the same vermillion (5+ voices for 4+ meanings). The status quartet is violated: no-membership renders as expired red when the system assigns it Void Gray.

**Deterministic scan:** 0 findings on MembersPage.tsx, ConfirmModal.tsx, RowMenu.tsx (exit 0, all clean). No false positives.

## Overall Impression

The round-2 P0s stayed fixed and the modal lifecycle is now genuinely excellent — but the round-3 work traded one P2 for another: the Add card moved below the fold and the focus-restore code path never runs its success path. The highest-stakes moment (destructive confirm) is the best-designed thing on the page; the end of every routine task (add, delete, pause success) is silent.

## What's Working

1. **ConfirmModal lifecycle is now correct** — pending disables buttons/Escape/backdrop, failures render in-dialog with role="alert" and re-enabled retry (ConfirmModal.tsx:37-45, 79-103; MembersPage.tsx:479-495); destructive closures rethrow with no swallowed catches (:239-243, :271-275, :287-291).
2. **Paused state is honest** — amber "Paused" badge (MembersPage.tsx:580-588) per Due Amber.
3. **One-menu-at-a-time + reduced-motion + QR cleanup** all verified (MembersPage.tsx:81, 612-614; RowMenu.tsx:45-60; :452-461).

## Priority Issues

**P1 — Focus restore is dead code in every path.** confirmTriggerRef captures document.activeElement at modal-open (:230, :262, :280) — always a RowMenu menuitem — but RowMenu closes the menu before dispatching the item (RowMenu.tsx:84-87), so the captured node unmounts in the same tick. The isConnected guard (:463-469) silently no-ops every time; focus falls to body. Fix: capture a durable target (the More trigger, or query by row id at restore time); add a test asserting focus lands on the trigger after cancel and confirm.

**P1 — Activate failures route to the Add-member card.** The non-destructive activate branch catches into shared setError (:224), rendered under the Add form (:954); nothing clears it on success, so stale errors linger. Fix: clear error before the attempt and/or render activate errors inline on the row.

**P2 — The row contradicts itself for cancelled members.** isActive:true + cancelled membership shows green "Active" (:585) above gray "Cancelled (plan)" (:49-51, :595-604), while the cancel modal promises "blocked from check-in". Fix: derive the badge from a single status source.

**P2 — "No membership" renders as expired/failure.** membershipState returns tone 'expired' for null (:43-45) — vermillion semibold for every walk-in — and the "Expired membership" filter includes no-membership (:173). DESIGN.md maps no-membership to Void Gray. Fix: tone 'neutral' for null; filter on status only.

**P3 — Add-member is silent and can be invisible.** Card below the list (:903); submit clears the form with no success signal; page >1 viewport clamps to page 1. Fix: transient "Member added" note and/or reset to page 1 with a scroll to the new row.

## Persona Red Flags

- **Alex (power user):** pause = menu click → modal → confirm (3 decisions for a 5-second op); Statement link is a full reload destroying search/filter/page state; no page-number jump.
- **Jordan (first-timer):** Create-login vs Link panels demand reading to distinguish; two "Active" filters are a first-interaction guess; non-danger modals autoFocus confirm — stray Enter pauses instantly; Deactivate and Delete share the same vermillion danger voice.
- **Sam (keyboard):** every modal exit dumps focus to body; role="menu" with no arrow keys and no focus entry; form errors are plain <p>s with no live region; background scrolls behind the fixed dialog; PIN Enter is an onKeyDown hack, not a form.

## Minor Observations

- member-panel-${id} reused by all four panels (safe only because one renders at a time)
- QR generation race: opening A then B can let A's resolution overwrite B's state
- Pause/Resume modals pass empty body while the message sits in the title — aria-describedby points at an empty paragraph
- primaryButtonClass vs dangerButtonClass differ only by underline — Delete reads like the primary CTA
- Filter chips carry no counts (DESIGN.md specifies counts in parens)
- Search input is placeholder-only labeled; everything else has aria-label
- Panel toggles don't clear the shared Add-form error (handleShowQr does — inconsistent)
- "Active" filter doesn't reflect pause — includes check-in-blocked members

## Questions to Consider

- If Add Member were the only vermillion thing on this page, what would row actions, filters, and errors look like?
- isActive + membership status produce contradictory UI — should the page expose one derived status?
- What test would have caught the focus-restore code path that never runs its success path?
