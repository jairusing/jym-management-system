# UI Design System

## Theme

Dark-first. Tokens (Tailwind arbitrary values):

| token            | value       | use                          |
|------------------|-------------|------------------------------|
| background       | `#0A0A0A`   | page background              |
| surface          | `#0F0F0F`   | sidebar, cards               |
| input surface    | `#1A1A1A`   | inputs                       |
| border           | `#262626`   | borders, dividers            |
| text primary     | `#FAFAFA`   | headings, body               |
| text muted       | `#737373`   | labels, hints, footers       |
| accent           | `#FF3D00`   | active states, CTAs, focus   |

- Font: `Inter Tight` / Inter (system fallback), set in `index.css`
- `color-scheme: dark`; focus ring `2px solid #FF3D00` for keyboard users
- Buttons/links scale to `0.95` with brightness bump on `:active`; `prefers-reduced-motion` respected

## Components (`src/components/ui/`)

- **PageShell** — app frame: responsive sidebar nav (mobile drawer + desktop rail), skip-to-content link, header with eyebrow/title/beta badge, footer. Nav groups + brand defined in the file; extend when adding features.
- **SectionCard** — titled card (`title`, optional `description`).
- **ActionLink** — CTA-style button or `href` link (orange outline).
- **BackLink** — back navigation link.

## Copy conventions

- Uppercase + `tracking-[0.2em]` labels, `text-[0.7rem]`/`text-sm` scale
- Ellipsis character `…` (U+2026) for pending states ("Saving…")
- Orange (`#FF3D00`) for actions/emphasis, muted gray for hints — never invent new colors