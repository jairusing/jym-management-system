---
target: Check-ins page (round 11 re-critique after v1.025 fixes)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-20T16-41-54Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Critique — Check-ins page (round 11 re-critique after v1.025 fixes)

## Method
- Assessment A: design review (sub-agent ses_fdff9ae21ffeb3cXWU3NtQNTiP)
- Assessment B: detector CLI + manual grep (sub-agent ses_fdffc0c41ffeMdXUXh88cGTd4b)
- Browser visualization skipped: no browser automation tool exposed.

## Design Health Score — 31/40 (Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | In-flight states solid, but QR loop runs every 150ms with zero visual indicator; success message top-of-card while the changed row is bottom-of-card. |
| 2 | Match System / Real World | 3 | Copy is product-specific; empty state says "No members match that name" while search also matches phone/email. |
| 3 | User Control and Freedom | 3 | Good cancels/Escape/BackLink; load failure is all-or-nothing (forms vanish, only Retry); no way to clear search or dismiss a stale success. |
| 4 | Consistency and Standards | 3 | Shared tokens consistent; accent=danger=error conflation; two adjacent forms with opposite Enter behavior; History has two equal primaries. |
| 5 | Error Prevention | 4 | Excellent layered guards: Enter no longer auto-checks-in, disabled for inactive/expired, already-checked-in guard, PIN gate, destructive confirm with autofocused Cancel. Nits: From>To silently no-ops; already-checked-in guard is a stale client-side list. |
| 6 | Recognition Rather Than Recall | 3 | Recent-5 default, rich rows, "Checked in today" badge, PIN panel names member; recent-5 assumes newest-first repo order (unverified), no live result count. |
| 7 | Flexibility and Efficiency | 3 | QR is the fast path, QR field supports hardware-scanner Enter-submit; search→Check in requires a mouse reach every time, no keyboard fast path, "Scan QR" + "Check in via QR" redundant for scanner-only staff. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean dark surface; red saturation real (every row carries a red-bordered Delete chip plus red badges/text/underlines); LoadError reuses the card's own bg/border and disappears into it. |
| 9 | Error Recovery | 4 | LoadError + working Retry, actionable denied-camera copy, PIN retry, in-modal delete error. Post-scan errors render top-of-card away from where the user was looking. |
| 10 | Help and Documentation | 2 | No explanation of the PIN step, no hint that search matches phone/email, no in-page help, raw Supabase errors exposed. |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict
Mostly grounded in THIS product: front-desk gym vocabulary (QR/member-ID entry, PIN gate, membership statuses, 3-day grace messaging, CSV attendance export) is specific and correct. What leaks toward generic/technical: the search form that submits to nothing, raw Supabase error strings in the LoadError block, and #FF3D00 serving as brand accent AND primary action AND error AND danger simultaneously.

## Deterministic scan
Detector CLI: exit 0, findings `[]` (clean). Manual grep confirmed all four v1.025 fixes are present (QrScanner dialog semantics incl. Escape + focus trap + restore; dangerButtonClass bordered chip with focus-visible fill; LoadError with role="alert" + Retry in both Check in and Today tabs). Detector misses: (1) chipClass has no focus-visible variant (Tabs uses raw buttons; chipClass exists for chips), (2) ~50 inline hex color literals bypassing design tokens across the 6 files (known repo-wide convention, deferred), (3) the inline PIN panel is not a landmark/live region.

## Overall Impression
The fix round did its job — four P1s are correctly implemented and the score moved up. But the gains are partially offset by two flow-blockers: the PIN step is a dead-end when a member forgets their PIN, and the search form's dead Enter swapped an accidental check-in for a silent keyboard dead-end. The counter works; it just doesn't keep a line of people moving.

## What's Working
1. Layered error prevention (Enter no longer auto-checks-in, disabled buttons for inactive/expired, already-checked-in guard, PIN gate, modal confirm with autofocused Cancel) — the most dangerous failure mode of a counter tool is defended at multiple layers.
2. Product-specific status vocabulary — badge set + dated grace-period warnings read as a real gym tool.
3. The QR + search split — hardware-scanner Enter-submit on the QR field, rich name/phone/email search with a recent-5 default, without modalizing the core task.

## Priority Issues
1. **[P1] PIN step is a dead-end with no escape hatch** — CheckInsPage.tsx:533-578. If a member forgot their PIN, Cancel aborts the check-in; there is no "member forgot PIN" path, and no explanation of why the prompt appeared. This stops the front-desk line. Fix: add an explainer + a staff-confirmed override (e.g. "Member forgot PIN — check in anyway") that surfaces a manager action or flags the record, rather than silently bypassing the gate.
2. **[P1] The search form is a form that submits to nothing** — handleSearch (CheckInsPage.tsx:196-198) only preventDefaults. Typing a name and pressing Enter does nothing; the fix traded accidental check-in for a silent interaction dead-end. Fix: drop the form wrapper (use a div) or make Enter focus the first result's "Check in" button (safe, does not check in) and update the helper text.
3. **[P2] Brand accent = danger = error color conflation** — dangerButtonClass (buttonClasses.ts:13-14) uses the same #FF3D00 as primary underline, error text, expired badges, eyebrows. Shape now distinguishes danger, but color is semantically polluted; every Today/History row has a red Delete chip and red reads as brand half the time. Fix: a distinct danger/error token (e.g. true red #DC2626) reserved for destructive/error semantics.
4. **[P2] Primary actions are understated and duplicated** — primaryButtonClass is a thin text-underline; History shows two at once ("Load" and "Export CSV"). The main act of the page ("Scan QR" / "Check in") is the quietest element, and two equal primaries dilute intent. Fix: one filled treatment for the single most important action per view; demote Export CSV to ghost.
5. **[P3] LoadError blends into the card, and the scan has no live indicator** — LoadError (CheckInsPage.tsx:31-42) reuses the card's own border/bg and reads as empty card space; the decode loop (QrScanner.tsx:45-59) gives no feedback while it searches. Fix: amber/red border on LoadError; a subtle scanning frame/pulse over the video plus an explicit "Scanning…" state.

## Persona Red Flags
- **Alex (fast front-desk power user):** QR flow is near-ideal, but the moment Alex types a name, Enter is dead and every search→check-in is a mouse detour (no keyboard fast path); a member who forgot their PIN stops the line with no override.
- **Sam (screen-reader/keyboard-only):** The QR dialog is a proper modal but contains exactly ONE focusable element — Cancel — so Sam cannot scan; the only way to check in is to Escape, find the QR text field, and type (an undiscovered path). The PIN panel is not a landmark/live region, so its appearance isn't announced. Dead Enter in the search form forces full Tab traversal.
- **Jordan (new staff):** PIN prompt appears with no explanation or override; LoadError shows a raw Supabase error string a front-desk hire can't act on; no guidance that search matches phone/email or what a member ID is.

## Minor Observations
- Two adjacent form elements with opposite Enter behavior (QR form checks in; search form is a dead no-op).
- Success confirmation is white (#FAFAFA) — reads like body text, not a success signal; the only green is the "Checked in today" badge.
- "Membership expired X — in 3-day grace until Y" is grammatically awkward.
- From > To date range silently no-ops with no message.
- StatusBadge has a warning tone never used on this page.
- Recent-5 label assumes repo ordering is newest-first — unverified.
- After a failed QR check-in, the stale code stays in the field.
- QrScanner doesn't lock body scroll or set background inert despite aria-modal="true".
- Check-in buttons are small targets (px-1 py-2), below ideal hit area for a fast counter.

## Questions to Consider
1. What if Enter in the search field focused (not triggered) the first result's "Check in" button — keeping the safety guarantee while restoring a keyboard path?
2. Should check-in be a strict two-step (scan-or-search → confirm) with a committed head-of-line model for processing a line of people, instead of a single scrollable card?
3. Is #FF3D00 really one token or two — would a distinct danger hue clarify hierarchy, the Delete chips, and the brand feel at once?

## Report format
VERIFIED — the four v1.025 fixes are present and correctly implemented; score moved 29 → 31/40. NEXT STEP — resolve the P1 PIN dead-end and the search form's dead Enter, both flow-blockers offsetting the fix round's gains.
