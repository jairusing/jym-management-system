---
target: Members page (round 6 critique after v1.032)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
p2_count: 2
timestamp: 2026-08-21T08-38-43Z
slug: apps-web-src-features-members-memberspage-tsx
---
# Members Page — Critique Round 6 (v1.032)

Method: dual-agent (A: ses_fdc8cc384ffe163Y3M7CCnIL5U · B: ses_fdc922e41ffeofCz8kJhkesL3d)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Strong pending states, but adding a member succeeds silently — no confirmation, no highlight |
| 2 | Match system & real world | 3 | Gym language natural; "Link existing" cryptic; "Statement" jargon-adjacent |
| 3 | User control & freedom | 3 | Cancelable panels/modals, Esc + outside-click; no undo; delete one confirm from oblivion |
| 4 | Consistency & standards | **1** | Ignores amber LoadError pattern; raw e.message in 6 places; ignores grace semantic Check-ins honors; inconsistent autoFocus |
| 5 | Error prevention | 3 | Excellent consequence-stated confirms; nothing prevents duplicate member creation |
| 6 | Recognition over recall | 3 | Inline panels explain themselves; conditional menus force inference |
| 7 | Flexibility & efficiency | 2 | No sort, no bulk actions, no URL-persisted filters/page, fixed 15/page |
| 8 | Aesthetic & minimalist | 3 | Disciplined; status stated twice for paused/cancelled; "MORE" clutters every row |
| 9 | Recognize & recover from errors | 2 | Local validation copy specific; backend failures leak raw Postgres/Supabase jargon |
| 10 | Help & documentation | 3 | Exemplary PIN rationale microcopy; no help for filter semantics or required fields |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

ON-SYSTEM visually, OFF-DIALECT behaviorally. Unmistakably the Bold Typography system (sharp sections, uppercase tracking labels, vermillion discipline, zero generic-SaaS leakage). But the page speaks last month's dialect: the freshly established standards — amber LoadError panel, human-copy errors with console.warn demotion, grace-aware statuses — were adopted by Check-ins and Payments and are absent here. Every color is a hardcoded hex literal rather than a token reference; the spec is imitated, not referenced.

Deterministic scan: detector exit 0 on both files; 33 hex occurrences across 7 values, ALL on-palette; #DC2626 absent; RowMenu adopted per-row with danger items (0 dangerButtonClass usages); 0 rounded/shadow/gradient; 0 unlabeled icon-only buttons; ring utilities intact on all four button classes. Findings: NO LoadError panel (bare red text + Retry); 6 catch sites pass raw e.message to UI state (lines 132, 211, 376, 417, 453, 499); three structurally parallel inline action panels (Create login 784-846, Link account 848-892, Set PIN 894-942).

Browser visualization unavailable — CLI scan + manual grep evidence only.

## Overall Impression

A handsome, disciplined page that hasn't been taught the app's new manners. The roster actively contradicts the front door: bold-red "Expired" for members Check-ins admits under 3-day grace. Six raw database error strings wait to be screenshotted. The bones are excellent — state-adaptive menus, consequence-rich confirms, real keyboard craft — but the polish standards that landed on Payments and Check-ins stopped at this page's border.

## What's Working

1. State-adaptive RowMenu composition (700-755): menu items appear only when meaningful for the member's actual state — error prevention disguised as IA.
2. Consequence-rich confirmation copy (237-239, 257-259): names the stake, deadline, and effect. Best UX writing on the page.
3. Keyboard/focus craftsmanship: RowMenu arrow navigation + focus restore, ConfirmModal Tab-trap, confirmTriggerRef returning focus to the originating trigger, prefers-reduced-motion respected.

## Priority Issues

### P0 — Grace-period blindness: the roster lies about who can get in
- What: membershipState() (52-61) marks anything past endsAt as expired → bold red. Check-ins admits these members for 3 more days. The "Active membership" filter also excludes grace members.
- Why: Two screens disagree about the same physical door; staff confront members who are legitimately inside; red loses authority.
- Fix: Port the grace calculation into membershipState() → amber "Grace until {date}" tone; include grace in the active filter.
- Command: shape

### P0 — Raw e.message surfaced to users in six places
- What: 132→577 (load), 211 (add), 376 (login), 417 (link), 453 (PIN), 499 (confirm) render raw exception text.
- Why: Database constraint names are not user copy; violates the explicit app-wide rule.
- Fix: Human sentence per site ("Couldn't save the PIN. Try again."), log detail via console.warn.
- Command: harden

### P1 — Load failure ignores the LoadError pattern
- What: 575-581 renders bare red text + primary-button Retry; established pattern is amber-bordered raised panel with role="alert" and ghost Retry.
- Why: The most stressful state is the least designed; invisible to screen readers.
- Fix: Extract LoadError into components/ui/ and adopt here.
- Command: polish

### P1 — Filter chips: state invisible to assistive tech, sub-touch targets
- What: All/Active/Inactive chips convey selection purely via color (no aria-pressed); ~24px height vs 44px minimum.
- Why: Screen-reader users hear three identical buttons with no state; touch users mis-tap.
- Fix: aria-pressed={selected}, min-h-[44px].
- Command: harden

### P2 — Silent success on member creation
- What: 204-209 clears fields and refetches; no confirmation, no highlight, new row materializes somewhere unnamed.
- Why: Breaks feedback loop at the highest-frequency write; first-timers will submit twice and create duplicates.
- Fix: Success line ("Added {name}") + scroll/highlight the new row.
- Command: onboard

### P2 — Paused/cancelled badge erases account status
- What: 649-661 — when membership is paused/cancelled, the Active/Inactive badge is replaced; a deactivated member with a paused plan shows only gray "Paused". "Paused (Plan)" printed again at 677.
- Why: Hides a blocked-check-in state while duplicating another.
- Fix: Show account and membership badges together; drop duplicated wording.
- Command: layout

## Persona Red Flags

- Alex: no sort ("who expires this week?" requires reading 500 rows), no bulk actions, filters lost on refresh, fixed page size, no search shortcut. A list, not yet a console.
- Sam: chip state invisible (no aria-pressed); errors/successes unannounced (bare p vs role="alert"/"status"); placeholder-as-label search; RowMenu trigger lacks focus-visible ring (only button violating the ring standard).
- Jordan: "Link existing"? Is email required? Did it work after submit? "Statement" of what?
- Riley: double-submit guarded; one menu/panel at a time; QR failure graceful. But already-registered email → raw constraint error.

## Minor Observations

"MORE" text on every row (15 shouts per screen); Notes is single-line input (wants textarea); pagination never says "Page 2 of 7"; PIN plaintext while typing (defensible at desk, show/hide toggle worth it); staff-set passwords lack generate-&-copy; Statement navigates same-tab discarding search/filter state; hardcoded hex everywhere; membershipState recomputed up to 3x per row per render.

## Questions to Consider

1. The front door forgives a 3-day lapse; the roster brands the same member red — which screen is telling the truth?
2. If staff set passwords, who absorbs the first "I can't sign in" call — and why no generate-&-copy?
3. Can your newest hire tell whether gray "Paused" also means deactivated? Today they can't, because the page doesn't say.
4. When member #500 arrives, does Prev/Next-with-no-sort survive contact with reality?
5. Why does every row shout "MORE" at a user who learned where the menu lives on row one?
