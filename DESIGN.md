---
name: Jym Management System
description: Front-desk gym operations in a bold typographic poster system — carbon, warm paper, one vermillion voice.
colors:
  primary: "#FF3D00"
  background: "#0A0A0A"
  surface: "#1A1A1A"
  card: "#0F0F0F"
  foreground: "#FAFAFA"
  muted-foreground: "#A3A3A3"
  border: "#262626"
  status-good: "#22C55E"
  status-warning: "#FFB300"
  status-bad: "#FF3D00"
  status-neutral: "#A3A3A3"
typography:
  display:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.2em"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.05em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 0"
  button-primary-hover:
    textColor: "{colors.primary}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 0"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  chip-selected:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "24px 32px"
  nav-item:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  nav-item-active:
    textColor: "{colors.primary}"
  status-badge:
    textColor: "{colors.status-good}"
    typography: "{typography.label}"
---

# Design System: Jym Management System

## Overview

**Creative North Star: "The Front-Desk Gallery"**

The system is poster design translated to web, put to work behind a gym's front desk. Typography is the entire visual language: headings are set like gallery wall text (Inter Tight, semibold, tight tracking `-0.04em`), labels whisper in wide-tracked all-caps (`0.1em`–`0.2em`), and the only color that ever raises its voice is vermillion `#FF3D00`. This is not friendly SaaS — it is a design manifesto that happens to run operations: check-ins, memberships, invoices, and class bookings rendered with the confidence of an exhibition catalog.

Density is mid-weight editorial. Records are separated by full-width hairline rules (`#262626`, 1px) rather than cards-with-shadows; a panel exists only where a task needs a surface (`#0F0F0F` on `#0A0A0A`). Interaction is typographic first: the primary CTA is a text-only button whose accent underline breathes on hover (scale-x 1 → 1.1), and every press answers with a 1px translate-down. Nothing bounces, nothing glows — motion is fast and decisive (150–200ms, `cubic-bezier(0.25, 0, 0, 1)`).

Because the audience is the desk staff in short bursts between members, hierarchy must be strict: headline → body → action, one action per view, and the vermillion voice reserved for what matters — check-in, payment, the active nav state, and errors.

**Key Characteristics:**
- Type as hero: massive tight-tracked headlines, whispered wide-tracked labels
- Restrained palette: carbon, warm paper, one vermillion accent + a semantic status quartet
- Sharp edges everywhere (0px radius), hairlines as the only borders
- Text-only CTAs with animated accent underlines — no button fills
- Flat, tonal depth: `#0A0A0A` → `#0F0F0F` → `#1A1A1A`, zero shadows
- Fast, decisive motion; press feedback via translate, never scale
- Uppercase, wide-tracked labels as the recurring voice of navigation and metadata

## Colors

A two-material world — near-black carbon and warm paper — with a single vermillion voice and a semantic status quartet. All values dark-mode first; the accent's warmth (`#FF3D00`) fights the cold background deliberately.

### Primary
- **Vermillion** (#FF3D00): The one loud color. Key CTAs, active nav, eyebrow labels, focus rings (2px outline, 2px offset), destructive actions, and the "bad" status. Used sparingly — its rarity is the point.

### Neutral
- **Carbon** (#0A0A0A): Page background. Near-black, not pure black — warm enough to sit under warm paper.
- **Ash Surface** (#1A1A1A): Muted surface elevation — input backgrounds, hover fills.
- **Slate Card** (#0F0F0F): Panel/sidebar surface — one step up from carbon.
- **Warm Paper** (#FAFAFA): Foreground text and primary outlines. 18.1:1 contrast on carbon.
- **Faded Ink** (#A3A3A3): Secondary text, ghost buttons, unselected nav. Raised from the spec's `#737373` for contrast on `#1A1A1A`.
- **Graphite Hairline** (#262626): Borders and dividers. Barely-there rules that structure every list and panel.

### Status Quartet (one meaning per color, app-wide via `StatusBadge`)
- **Paid Green** (#22C55E): Good — paid, active membership, active member.
- **Due Amber** (#FFB300): Pending/warning — issued invoice, expiring membership, paused.
- **Blocked Red** (#FF3D00): Bad — expired membership, overdue invoice, inactive member. Same value as the accent; context distinguishes them.
- **Void Gray** (#A3A3A3): Neutral — void invoice, cancelled membership, no membership.

**The One Voice Rule.** Vermillion appears on ≤5–10% of any given screen — key CTAs, active nav, statuses. If two loud things compete, one of them is wrong. Rarity is the point.

## Typography

**Display Font:** Inter Tight (with Inter, system-ui fallback)
**Body Font:** Inter Tight (with Inter, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with Fira Code, monospace fallback) — labels, stats, technical details

**Character:** Geometric, professional, and tight — Inter Tight's compressed letterforms carry the poster energy without ornament. Headlines track tight (`-0.04em`), labels track wide (`0.1em`–`0.2em`), body stays slightly tightened (`-0.01em`). The gap between the loud headline and the whispered label creates the gallery tension.

### Hierarchy
- **Display** (600, clamp(2rem → 3rem), 1.1, `-0.04em`): Page titles in the header (implemented as `text-3xl → text-5xl`). The single loudest statement on any screen.
- **Title** (600, 1.25rem, 1.25, `-0.04em`): Section and row titles — member names, invoice numbers.
- **Body** (400, 1rem, 1.6, `-0.01em`): Default text. 16px minimum (prevents iOS zoom). Descriptions capped at `max-w-2xl`/`max-w-3xl`.
- **Label** (600, 0.7rem, 1, `0.2em`): All-caps metadata — eyebrows, section labels, nav items, status badges. The system's whisper.
- **Mono** (400, 0.875rem, 1.5, `0.05em`): Stats and technical detail where digits should feel machined.

**The Poster Type Rule.** Type never shares the stage: one display statement per screen, and every label earns its caps. If a screen needs two competing headlines, the hierarchy is broken.

## Layout

Container is `max-w-5xl` (1200px), and the app shell is a fixed 288px sidebar (`w-72`) with hairline right rule (`border-r #262626`) on desktop, collapsing to a slide-in drawer (`max-w-[85vw]`, `bg-[#0F0F0F]`) under `lg`. Main content carries `px-6 → sm:px-8 → lg:px-12` padding with `py-16` vertical rhythm, stacked `gap-10`.

Structure comes from rules, not cards: full-width hairline borders (`border-b #262626`) close each page header; lists divide rows with `py-5` hairlines; section headers stack eyebrow (vermillion, 0.7rem caps) → title (`text-3xl`→`text-5xl`, `-0.04em`) → description (`max-w-3xl`, `text-base → lg:text-lg`, `leading-relaxed`, Faded Ink).

Navigation (desktop sidebar, mobile drawer) groups items with 0.7rem caps group labels, each item `text-sm uppercase tracking-[0.1em]`; the active item is vermillion text with a 2px vermillion left rule (`lg:border-l-2`).

**The Hairline Rule.** Structure is drawn with 1px `#262626` lines, never shadows or fills. A screen without hairlines reads as unfinished; a screen that needs more than hairlines is trying to say two things at once.

## Elevation & Depth

Flat by default — the system uses **zero shadows**. Depth is conveyed three ways: **tonal layering** (carbon → slate card → ash surface), **hairline dividers**, and **typographic state changes** (underline scale-x 100→110, press translate-y 1px, `active: scale(0.95) + brightness(1.2)` on interactive elements at 100ms).

Floating layers (the More row menu, the mobile drawer) elevate via surface color (`#0F0F0F`) and border (`#262626`) alone — a shadow would betray the poster's flatness.

**The Flat-By-Default Rule.** No box-shadow, ever. Elevation is a color change or a line, not a lift. If a layer needs separation, give it a border and a lighter surface — not a shadow.

## Shapes

The system is aggressively square: **0px radius everywhere** — buttons, inputs, chips, cards, badges, menus. Form is communicated by 1px hairlines (`#262626`) and, on focus, a 2px vermillion outline at 2px offset (no glow, no ring). Cards are flat rectangles; inputs are flat rectangles; the only curved things in the product are the data points it manages.

## Components

### Buttons
- **Shape:** Sharp (0px radius). Text-only, no fills in the resting state.
- **Primary:** Vermillion text, uppercase, `tracking-[0.1em]`, semibold, `py-2`, no horizontal padding. A 2px vermillion underline sits at the baseline, `scale-x-100` at rest, `scale-x-110` on hover, 150ms `cubic-bezier(0.25,0,0,1)`. Press: `translate-y-px`. Disabled: `opacity-50`, no pointer events.
- **Hover / Focus:** Underline stretches (never appears — it is always there, it breathes); focus-visible shows the 2px vermillion outline.
- **Outline:** 1px warm-paper border, paper text, `px-6 py-2`; hover inverts fully (`bg #FAFAFA`, text carbon). For secondary actions that must still feel like buttons.
- **Ghost:** Faded Ink text, `px-4`, no border; a 1px underline scales 0→100 on hover and the text warms to paper. For tertiary/link-like actions.
- **Danger:** Same anatomy as ghost but vermillion text and vermillion underline. For destructive actions (delete, void, cancel membership).

### Chips (filter/status chips)
- **Style:** Sharp rectangle, 1px Graphite Hairline border, Faded Ink 0.7rem uppercase `0.2em` text, `px-4 py-2`, slate card background.
- **State:** Selected inverts — Warm Paper fill, carbon text, no border change. One selected chip per filter group; counts in parens (`(3)`).

### Cards / Containers
- **Corner Style:** Sharp (0px).
- **Background:** Slate Card (`#0F0F0F`) — SectionCard on carbon; the sidebar shares the surface.
- **Shadow Strategy:** None (see Elevation).
- **Border:** 1px Graphite Hairline; the accent variant swaps the border to vermillion (featured/highlighted only).
- **Internal Padding:** `p-6` (24px) mobile → `p-8` (32px) desktop. Content inside is stacked `gap-3`–`gap-4`.

### Inputs / Fields
- **Style:** Ash Surface fill (`#1A1A1A`), 1px Graphite Hairline border, sharp corners, 48px height (`h-12`; `h-14` on desktop where scale demands), `px-4`, 16px text (no iOS zoom).
- **Focus:** Border warms to vermillion. No ring, no glow, no fill change.
- **Error / Disabled:** Disabled is `opacity-50` + `cursor-not-allowed`; errors surface as vermillion validation text under the field, never as a filled state.

### Navigation
- **Style:** Sidebar (desktop) / drawer (mobile), slate card surface with hairline right rule. Group labels 0.7rem caps Faded Ink `0.2em`; items `text-sm uppercase tracking-[0.1em]` semibold, Faded Ink → Warm Paper on hover, Vermillion + 2px left rule when active. Section tabs (Payments, Check-ins) use the same caps treatment with chip selection.

### Status Badge
- **Style:** 0.7rem uppercase `0.2em`, colored per the Status Quartet (Paid Green / Due Amber / Blocked Red / Void Gray). A word, not a dot — the typographic system refuses icons where type works. It sits inline after a title (`ml-3`).

### Row Menu ("More")
- **Style:** Sharp rectangle, 1px Hairline border, slate card fill, `w-56`-ish column. Trigger is a ghost-style More button (16px `MoreHorizontal` icon, stroke 1.5). Items are `text-sm uppercase tracking-[0.1em]` with 14px icons (stroke 1.5) left of label, Faded Ink → Warm Paper on hover; destructive items are vermillion. Closes on outside-click, Escape, or item select. Icons are outline/stroke only, `currentColor`.

## Do's and Don'ts

### Do:
- **Do** set page titles `text-3xl → sm:text-4xl → lg:text-5xl`, semibold, `-0.04em` — the one display statement per screen.
- **Do** whisper metadata: 0.7rem uppercase, `0.2em` tracking, Faded Ink.
- **Do** divide with 1px `#262626` hairlines (`border-b`, `py-5` rows) instead of card walls.
- **Do** use the text-only primary CTA with its 2px vermillion underline for the single action of each view.
- **Do** invert chips on selection (Warm Paper fill, carbon text).
- **Do** use vermillion sparingly: active nav, key CTAs, eyebrows, destructive actions, focus outlines.
- **Do** respect `prefers-reduced-motion` — the app already collapses all transitions to ~0ms.

### Don't:
- **Don't** add border-radius anywhere (0px invariant).
- **Don't** use box-shadows for elevation — tonal layering and hairlines only.
- **Don't** add fills to primary buttons — text + underline is the primary affordance.
- **Don't** let two vermillion elements compete on one screen.
- **Don't** use filled icons or stroke widths above 1.5 — outline strokes only, `currentColor`.
- **Don't** replace status words with colored dots — one meaning per color, type carries the message.
- **Don't** bounce, glow, or spring motion — 150–200ms and `cubic-bezier(0.25,0,0,1)` only.