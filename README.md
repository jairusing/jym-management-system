# Jym Management System

A gym business management system for the Philippine market — members,
check-ins (QR + PIN), classes, invoices/payments, staff roles, audit trail,
and a dashboard. Built as a thesis project with real-world use in mind.

Live app: `jym-management-system.vercel.app` · Auto-deploys from `main`.

## Features

- **Members** — CRUD, search/filter/pagination, memberships with 3-day grace
  (amber "Grace" vs red "Expired"), pause/resume/cancel, member logins
  (staff-created or linked to self-signups), QR codes, optional bcrypt-hashed
  PINs
- **Check-ins** — unified search/ID entry, camera QR scanning, keyboard
  two-step flow, duplicate prevention enforced at the database level,
  today/history tabs with CSV export (Manila timestamps)
- **Classes** — weekly class definitions, session materialization, capacity-
  enforced bookings
- **Payments** — record-only invoices with sequential `INV-YYYY-####` numbers,
  atomic payment RPC (amount must match exactly), void/undo with audit trail,
  per-staff collection totals
- **Dashboard** — attendance stats + 7-day chart, revenue, outstanding,
  renewal reminders for memberships expiring within 3 days
- **Activity log** — immutable audit trail of destructive actions
- **Roles** — owner / staff / member, enforced by Row Level Security

## Stack

React 18 + TypeScript + Vite + Tailwind CSS · Supabase (Postgres, Auth, RLS)
· Vercel serverless functions (service-role boundary) · Vitest

## Documentation

| Doc | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System context, deployment topology, sequence diagrams |
| [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) | Contracts for the serverless endpoints |
| [`docs/DATABASE.md`](docs/DATABASE.md) / [`docs/ERD.md`](docs/ERD.md) | Schema and entity relationships |
| [`docs/RLS.md`](docs/RLS.md) | Role model, policies, threat notes |
| [`docs/AUDIT.md`](docs/AUDIT.md) | Adviser audit findings and their statuses |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy and evidence |
| [`CHANGELOG.md`](CHANGELOG.md) | Every release since v1.001 |

## Development

```bash
cd apps/web
npm install
npm run dev        # local dev server (mock data without Supabase env vars)
npm test           # unit suite; live integration tests skip without env vars
npm run build      # typecheck + production build
```

Environment variables (Vercel project settings or `.env`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, plus `SUPABASE_SERVICE_ROLE_KEY` server-side for the
login functions. Live integration tests additionally need `JYM_TEST_EMAIL` /
`JYM_TEST_PASSWORD` (owner) and `JYM_MEMBER_EMAIL` / `JYM_MEMBER_PASSWORD`
(credentials are not committed).
