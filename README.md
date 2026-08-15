# Jym Management System

A gym business management system built on [Web Starter](https://github.com/jairusing/web-starter) (React + Vite + TypeScript + Supabase with RLS). Thesis/business project.

## Features

- **Auth**: sign up, sign in, password reset, protected routes, profile page with password change
- **Design system**: dark theme (accent `#FF3D00`), PageShell with responsive nav, SectionCard, ActionLink, BackLink
- **Security**: CSP + security headers, RLS-secured database, SPA fallback

## Roadmap

1. Members CRUD
2. Check-in flow
3. Class schedule + bookings
4. Payments/invoices (record-only)
5. Owner dashboard (attendance, revenue)

## Setup

1. `npm install` in `apps/web`
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in your Supabase URL + anon key
3. Link the CLI and push migrations:
   ```
   cd supabase
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. Run:
   ```
   cd apps/web
   npm run dev       # http://localhost:3000
   npm test          # vitest unit tests
   npm run lint
   npm run build     # outputs to apps/web/dist
   ```

## Repo layout

```
apps/web/            React + Vite + TypeScript app
supabase/            Supabase config + migrations
docs/                Conventions (inherited from Web Starter)
```

Master plan: see `PLAN.md` in the Jym Tracker repository (topology, phases, decisions).