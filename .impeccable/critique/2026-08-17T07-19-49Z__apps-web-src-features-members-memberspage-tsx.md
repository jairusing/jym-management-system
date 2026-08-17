---
target: MembersPage.tsx critique re-run after P0/P1 fixes
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T07-19-49Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Impeccable Critique — MembersPage (v1.012 re-run)

## Design Health Score: 27/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading is text-only; delete/cancel success is silent; action failures render in the Add-member card, far from the action |
| 2 | Match System / Real World | 3 | Right domain language, but two "Active" meanings (status chip vs membership select); paused member badge says "Active" |
| 3 | User Control and Freedom | 3 | Escape works everywhere; but modal backdrop is not click-to-dismiss, no focus restoration |
| 4 | Consistency and Standards | 3 | DESIGN.md tokens consistent; confirm/cancel order swaps between danger and non-danger dialogs; role="menu" without arrow keys |
| 5 | Error Prevention | 3 | Consequence copy before destructive acts is genuinely good; Cancel auto-focused in danger mode; no undo |
| 6 | Recognition Rather Than Recall | 3 | Row anatomy inline; 8 actions behind More; two date formats in one row (formatDate vs formatWhen) |
| 7 | Flexibility and Efficiency | 2 | Enter submits PIN panel only, not login/link panels; no shortcuts, no menu keyboard nav, click-heavy |
| 8 | Aesthetic and Minimalist Design | 3 | Faithful to the Front-Desk Gallery; Add-member card above list pushes daily task below fold; three competing CTAs |
| 9 | Error Recovery | 2 | Load error + Retry landed; but every action failure routes to one shared error state in a different card; modal closes before op completes |
| 10 | Help and Documentation | 3 | No docs, but inline panel copy is excellent; membership select lacks composition hint |
| **Total** | | **27/40** | **Acceptable (up from 25)** |

## Design Specificity Verdict

**Mostly authored for this product (~65-70%), generic CRUD spine remains.** The gym model is genuinely baked in: deactivation warns check-ins are blocked immediately (MembersPage.tsx:228), pause/cancel are first-class state transitions, the PIN panel explains the QR-screenshot theft threat, walk-in registration is called out, PH timezone throughout. What remains interchangeable: search → filter chips → paginated list → row overflow menu scaffold and the Add-member form — any CRM has the same anatomy.

**Deterministic scan:** 0 findings on MembersPage.tsx and ConfirmModal.tsx (detector exit 0 both files). No false positives. Note the detector cannot see interaction-level issues — those are all in Assessment A.

## Overall Impression

The four P0/P1 fixes landed and are verified in source — and they bought 2 points. But each fix exposed the next layer: the confirm modal now closes before the operation finishes, and the page's single shared error channel still strands destructive-failure messages in the Add-member card. The best-designed part is the destructive confirmation copy; the weakest is feedback after the click.

## What's Working

1. **Consequence-aware destructive confirmation with Cancel-first focus** — deactivate warns about the live plan, cancel says "cannot be undone", delete names record + membership + check-in history (MembersPage.tsx:227-229, 252, 261-263, 281); danger dialogs autoFocus Cancel (ConfirmModal.tsx:31). The most reassured moment in the app.
2. **Honest failure with an escape hatch** — `load()` surfaces `loadError` with a working Retry (MembersPage.tsx:114-131, 528-534); empty states distinguish "no members" from "no filter matches" (:586-591).
3. **Panels that explain themselves** — QR, PIN (screenshot-threat rationale), login and link panels each carry their reasoning inline — the closest thing to documentation the page has.

## Priority Issues

**P0 — Row-action failures render in the wrong place.** `error` is one page-level state shared by the Add form and every row action (handleDelete :278-294, handleToggleActive :219/:238, handleMembershipStatus :272 all setError), but the only render is inside the Add-member card (:517). A failed delete shows its message five hundred pixels up the page in a card labeled "Add member". At the desk this invites a double-executing retry. Fix: render per-action errors near the action — a transient toast, an error line inside the ConfirmModal that stays open on failure, or per-row error regions. (Suggested: /impeccable harden)

**P0 — ConfirmModal closes before the operation finishes.** onConfirm does `setPendingConfirm(null); void run();` (MembersPage.tsx:910-914). A hanging request gives zero feedback; a failing one strands the error in the Add card. Fix: keep the modal open, disable buttons with a "Deleting…" label, close only on success, render the thrown error in the modal with Retry. (Suggested: /impeccable harden)

**P1 — Multiple More menus can be open simultaneously.** Each RowMenu owns its `open` state (RowMenu.tsx:19); row 5's menu does not close row 2's, and the second open steals click-away from the first. Two floating layers violate the flat-by-default rule and create ambiguity before a destructive item. Fix: lift the open-menu id to the page (like `openPanel` :449). (Suggested: /impeccable polish)

**P1 — Modal keyboard behavior incomplete.** role="dialog" without focus trap (Tab walks into the page behind), no aria-describedby, no focus restoration after close, backdrop doesn't dismiss (ConfirmModal.tsx:14-24). A keyboard user can lose focus mid-critical-action. Fix: trap Tab, restore focus to the trigger, make overlay click cancel. (Suggested: /impeccable audit)

**P2 — Enter doesn't submit the login/link panels.** PIN panel handles Enter (MembersPage.tsx:838-843); login/link panels are plain divs with type="button" buttons (:762-777, :801-815). Fix: wrap in `<form>` or add onKeyDown. (Suggested: /impeccable harden)

**P2 — Add-member card dominates above the daily task.** The Add form precedes the list (:466-525 vs :527-901); on a 13" laptop the list header and first row sit below the fold. Fix: collapse the form behind a trigger or move the list first. (Suggested: /impeccable layout)

## Persona Red Flags

- **Jordan (first-timer):** "Add member" is vermillion text among other vermillion text — the weakest affordance on the page; then faces two near-identical email panels (Create login vs Link existing — same single field, same two-button footer), deciding by gray subtitle; ~50% wrong-pick rate.
- **Sam (keyboard/screen reader):** role="menu" without arrow-key nav; non-danger modal auto-focuses confirm so a stray Enter pauses instantly; danger dialogs let Tab escape into the page behind; focus dropped after close.
- **Riley (stress tester):** two menus open at once; cancel modal vanishes instantly with no "Cancelling…" state; a network failure on cancellation renders its error in the Add-member card at the top — invisible to the person watching the row.

## Minor Observations

- `qrDataUrl` never cleared when opening another panel (latent stale-state bug).
- All four panels share the id `member-panel-${id}` — safe only because siblings are mutually exclusive.
- scrollIntoView uses behavior:'smooth' unconditionally — DESIGN.md mandates prefers-reduced-motion respect.
- RowMenu has no max-h/overflow handling; menus on short screens can extend below the viewport.
- Buttons define no focus-visible styling though DESIGN.md specifies a 2px vermillion outline.
- "Statement" ghost link per row competes with the More menu.
- Members count in the card header ignores active filters while the footer count respects them — two numbers that don't reconcile.
- Load-error copy is the raw Supabase `e.message` — likely technical.

## Questions to Consider

- Why does the error anchor live in the Add-member card — deliberate "errors are rare" choice, or structural debt during a network outage at check-in rush?
- If the menu is grouped already, why does "Statement" sit outside it as a fifth per-row affordance?
- Login and Link are the same card with different subtitles — would one auto-detecting "Set up sign-in" flow remove a class of wrong-choosing?
