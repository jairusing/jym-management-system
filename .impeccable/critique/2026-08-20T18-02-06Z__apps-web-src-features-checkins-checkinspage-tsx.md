---
target: Check-ins page (round 12 re-critique after v1.026)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-08-20T18-02-06Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Check-ins Page — Critique Round 12 (v1.026)

Method: dual-agent (A: ses_fdfacf075ffeQunTHAgNOi9plm · B: ses_fdfacdcc0ffe9L7GG2XJvj8RHe)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Two-step Enter→focus is invisible; success message is white body text |
| 2 | Match System / Real World | 3 | PIN override copy superb; "Check in via QR" ambiguous; empty state says "no members match that name" while search also matches phone/email |
| 3 | User Control and Freedom | 3 | Cancels everywhere; no way to clear search query or dismiss stale success toast |
| 4 | Consistency and Standards | 3 | #DC2626 gone, one-voice vermillion restored; grace-warning uses red while amber warning token sits unused; two adjacent forms have opposite Enter behavior |
| 5 | Error Prevention | 3 | Guards layered, but invisible focus means double-Enter still checks in with zero visual warning |
| 6 | Recognition Rather Than Recall | 3 | Recent-5 default + named PIN panel strong; no live result count; stale PIN digits left after "Incorrect PIN" |
| 7 | Flexibility and Efficiency | 3 | QR fast path + scanner Enter-submit intact; keyboard search path restored but undiscoverable and silent |
| 8 | Aesthetic and Minimalist | 3 | Clean dark surface, sharp corners; red saturation on rows + LoadError blends into its card |
| 9 | Error Recovery | 4 | Honest LoadError + Retry, PIN retry, in-modal delete error |
| 10 | Help and Documentation | 3 | PIN explainer landed (round-11 P1 resolved); Enter path undocumented; raw Supabase errors possible |
| **Total** | | **31/40** | **Good — flat** |

Why flat (31 → 31) despite two P1s landing: round-11's PIN dead-end is fully resolved (+), Help rose 2→3 (+1), but the dead-Enter fix shipped with focus styling visually identical to idle (−1), quietly re-opening the most dangerous failure mode.

## Design Specificity Verdict

**Mostly product-specific, with two generic leaks.** The page speaks fluent gym-counter: QR/member-ID entry, named-PIN identity gate with staff override, 3-day grace logic, method-labeled check-ins, PH-timezone CSV export. The PIN override block (559-631) is the most product-specific UI on the page. Leaks: two near-identical stacked text inputs (QR vs search), a per-row Delete underline on every row, white success text, red doing warning duty for a non-blocking state.

**Deterministic scan:** Detector exit 0, 0 findings on CheckInsPage, buttonClasses, RowMenu. 0 #DC2626 in the checkins folder (v1.027 cleanup intact). 0 focus-visible inline (shared in buttonClasses). 0 rounded/shadow/gradient. All 16 buttons have text; 0 icon-only. PIN override markup is accessible text ("Member forgot PIN", "Check in anyway?"). dangerButtonClass = #FF3D00 vermillion ghost. Hex colors: #A3A3A3 x17, #FAFAFA x7, #262626 x6, #FF3D00 x5, #FFB300 x2, #1A1A1A x2, #0F0F0F x1 — all on-palette.

**Visual overlays:** Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

Both round-11 P1s are addressed — the PIN override is genuinely best-in-class and #DC2626 is gone. But the score is flat because the two-step Enter fix shipped without perceptible focus feedback, re-opening the accidental-check-in path it was meant to close, and the grace-state-red semantics remain. The counter improved its vocabulary while quietly keeping its most dangerous failure mode.

## What's Working

1. **PIN override flow (559-631)** — explains why, names the member, states the bypass verbatim, fully reversible. Closes round-11's P1 cleanly; the best-conceived flow on the page.
2. **Honest, layered failure handling** — LoadError with role="alert" + working Retry replaces silent mock-fallback; expired/paused/inactive guards with correct 3-day grace mean button state and message state agree.
3. **Token discipline post-v1.027** — zero #DC2626; danger is vermillion ghost exactly per UI_DESIGN.md; method micro-labels and StatusBadge/Tabs/SectionCard reuse shared components.

## Priority Issues

### P1 — The two-step Enter→focus is invisible; double-Enter still checks in
- **What:** handleSearch focuses the first match's button (197-204), but primaryButtonClass focus-visible is text-[#FF3D00] (identical to idle) + after:scale-x-110 (a 10% underline stretch) — no ring, no offset. UI_DESIGN.md:236 mandates "2px ring in accent, 2px offset."
- **Why it matters:** A focused button activates on Enter. An operator who double-presses Enter (natural "Enter should check in" muscle memory) checks the member in — exactly the accident v1.025 was built to stop — with zero signal step 1 happened.
- **Fix:** Give all button classes a real focus-visible ring (2px accent, 2px offset) in buttonClasses.ts; update the helper copy (497) to teach "type to search, Enter focuses Check in, Enter checks in."
- **Suggested command:** harden / polish

### P1 — Red is doing warning duty on a state where the member CAN still check in
- **What:** Grace/expired members render tone="bad" red "Expired" badge + red message "…in 3-day grace until… Renew soon." (459-467, 472-474, 534-536), and can stack two red badges (Inactive + Expired). UI_DESIGN.md:105 reserves amber #FFB300 for expiring/warning; the StatusBadge warning tone is never used here.
- **Why it matters:** Red = blocked is semantics staff rely on at speed; painting a check-in-able member red teaches them to ignore the color exactly when needed.
- **Fix:** Grace → tone="warning" (amber) "Expiring" badge + amber message; red strictly for blocked (paused/cancelled/past-grace); at most one red badge per row.
- **Suggested command:** colorize / polish

### P2 — Success is white — reads as body copy, not a signal
- **What:** Line 26: text-[#FAFAFA] success line, identical to row names. The only green is the "Checked in today" badge.
- **Why it matters:** At a fast counter the confirmation is the payoff; if it doesn't register as success, staff re-check or double-count.
- **Fix:** Use good token #22C55E for success text; errors stay vermillion.
- **Suggested command:** colorize

### P2 — LoadError is camouflage — blends into its own card
- **What:** Lines 31-42: bg-[#0F0F0F] border-[#262626], identical to SectionCard's surface.
- **Why it matters:** A failure block that looks like empty card padding gets missed.
- **Fix:** Distinct amber border + raised surface (e.g. bg-[#1A1A1A] border-[#FFB300]).
- **Suggested command:** polish

### P2 — First-paint density and QR-first priority
- **What:** Two near-identical text inputs stacked (387-413 QR, 415-429 search); "Scan QR" is the lone primary on first paint; History shows two equal primaries ("Load" + "Export CSV", 708-713).
- **Why it matters:** The 90% action (name search) competes with the scan path; two equal primaries dilute intent; a name typed into the QR field is a common mis-entry.
- **Fix:** One entry field ("Search or paste member ID…") routing names to search and IDs to check-in; demote Export CSV to ghost; single primary per view.
- **Suggested command:** shape / layout

## Persona Red Flags

- **Alex (fast front-desk):** invisible two-step means double-Enter still burns a check-in; no way to tell step 1 happened; stale QR code after a failed scan must be cleared manually; red grace rows add alarm noise every morning.
- **Sam (screen-reader/keyboard):** PIN panel is not a landmark or live region, so its appearance is unannounced; focus hop has no perceivable state change; Tabs has role="tablist" but no aria-controls/tabpanel pairing and no arrow-key roving; duplicated checkin-button-* IDs across two list branches.
- **Jordan (new staff):** a member in grace appears red-badged "Expired" but the Check-in button is enabled — contradiction with no explanation; Enter→focus→Enter path undocumented; raw Supabase error strings can surface.
- **Riley (manager):** override requires no manager credential and leaves no visible audit flag; any agent can silently bypass the gate; per-row visible Delete everywhere with no bulk/reconcile path.

## Minor Observations

- Duplicate render block (442-487 vs 504-549) — identical row JSX including duplicated IDs; fixes must land twice (drift risk).
- From > To silently no-ops (110-112) — no message.
- PIN error leaves stale digits, doesn't refocus the field (289-296).
- Grammar: "…in 3-day grace until…" awkward (176); round-11 noted, still open.
- StatusBadge warning tone never used — it exists precisely for the grace state.
- Check-in buttons ~34px — below the 44px desk target (UI_DESIGN.md:424).
- verifyMemberPin(member.id, '') is a network round-trip before every check-in just to learn whether a PIN exists.
- Recent-5 assumes repo order newest-first — unverified.

## Questions to Consider

1. If the two-step's only feedback is a 10% underline stretch, is it really a two-step — or should Enter open the PIN gate directly for the first match (a committed, modal two-step) so the safety is structural rather than perceptual?
2. If any desk agent can bypass a PIN with one click and nothing marks the record, what does the gate protect — should the override require a manager PIN or stamp a visible "PIN bypassed" flag?
3. Should the wall of per-row "Check in" buttons become a queue instrument — one persistent "Check in [first match]" action plus row selection?
4. The camera button is the first and only primary — but is scanning really the 90% desk action, or name-search?
5. Red is reserved for "blocked," yet the most common desk state (expired-in-grace, still check-in-able) is painted red — when a color is used for non-urgent states 80% of the time, do you keep the color's meaning or change the state's color?
